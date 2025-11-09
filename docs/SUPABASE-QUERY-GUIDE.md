# 🔄 MySQL to Supabase Query Conversion Cheat Sheet

Quick reference for converting your MySQL queries to Supabase queries.

---

## 📚 Common Query Patterns

### SELECT Queries

**MySQL:**

```typescript
const [rows] = await pool.query("SELECT * FROM reports WHERE status = ?", [
  "Pending",
]);
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .select("*")
  .eq("status", "Pending");

if (error) throw error;
```

---

### SELECT with JOIN

**MySQL:**

```typescript
const [rows] = await pool.query(
  `
  SELECT r.*, d.name as department_name 
  FROM reports r 
  LEFT JOIN departments d ON r.assigned_department_id = d.department_id
  WHERE r.report_id = ?
`,
  [reportId]
);
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .select(
    `
    *,
    departments:assigned_department_id (
      name,
      code
    )
  `
  )
  .eq("report_id", reportId)
  .single();

if (error) throw error;
```

---

### INSERT

**MySQL:**

```typescript
const [result] = await pool.query(
  "INSERT INTO reports (title, description, category) VALUES (?, ?, ?)",
  [title, description, category]
);
const reportId = result.insertId;
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .insert({
    title,
    description,
    category,
  })
  .select()
  .single();

if (error) throw error;
const reportId = data.report_id;
```

---

### UPDATE

**MySQL:**

```typescript
await pool.query("UPDATE reports SET status = ? WHERE report_id = ?", [
  "In Progress",
  reportId,
]);
```

**Supabase:**

```typescript
const { error } = await supabaseAdmin
  .from("reports")
  .update({ status: "In Progress" })
  .eq("report_id", reportId);

if (error) throw error;
```

---

### DELETE

**MySQL:**

```typescript
await pool.query("DELETE FROM notifications WHERE notification_id = ?", [
  notificationId,
]);
```

**Supabase:**

```typescript
const { error } = await supabaseAdmin
  .from("notifications")
  .delete()
  .eq("notification_id", notificationId);

if (error) throw error;
```

---

### COUNT

**MySQL:**

```typescript
const [rows] = await pool.query(
  "SELECT COUNT(*) as count FROM reports WHERE status = ?",
  ["Pending"]
);
const count = rows[0].count;
```

**Supabase:**

```typescript
const { count, error } = await supabaseAdmin
  .from("reports")
  .select("*", { count: "exact", head: true })
  .eq("status", "Pending");

if (error) throw error;
```

---

### LIKE Search

**MySQL:**

```typescript
const [rows] = await pool.query("SELECT * FROM reports WHERE title LIKE ?", [
  `%${searchTerm}%`,
]);
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .select("*")
  .ilike("title", `%${searchTerm}%`);

if (error) throw error;
```

---

### ORDER BY and LIMIT

**MySQL:**

```typescript
const [rows] = await pool.query(
  "SELECT * FROM reports ORDER BY created_at DESC LIMIT 10"
);
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(10);

if (error) throw error;
```

---

### OFFSET (Pagination)

**MySQL:**

```typescript
const [rows] = await pool.query(
  "SELECT * FROM reports ORDER BY created_at DESC LIMIT ? OFFSET ?",
  [limit, offset]
);
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .select("*")
  .order("created_at", { ascending: false })
  .range(offset, offset + limit - 1);

if (error) throw error;
```

---

### IN Operator

**MySQL:**

```typescript
const [rows] = await pool.query(
  "SELECT * FROM reports WHERE status IN (?, ?)",
  ["Pending", "In Progress"]
);
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .select("*")
  .in("status", ["Pending", "In Progress"]);

if (error) throw error;
```

---

### BETWEEN

**MySQL:**

```typescript
const [rows] = await pool.query(
  "SELECT * FROM reports WHERE created_at BETWEEN ? AND ?",
  [startDate, endDate]
);
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .select("*")
  .gte("created_at", startDate)
  .lte("created_at", endDate);

if (error) throw error;
```

---

### NULL Checks

**MySQL:**

```typescript
const [rows] = await pool.query(
  "SELECT * FROM reports WHERE resolved_at IS NULL"
);
```

**Supabase:**

```typescript
const { data, error } = await supabaseAdmin
  .from("reports")
  .select("*")
  .is("resolved_at", null);

if (error) throw error;
```

---

## 🔐 Authentication Queries

### User Signup

**MySQL:**

```typescript
const [result] = await pool.query(
  "INSERT INTO citizens (full_name, email, password_hash) VALUES (?, ?, ?)",
  [fullName, email, hashedPassword]
);
```

**Supabase:**

```typescript
// Create auth user
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: fullName },
  },
});

if (authError) throw authError;

// Store additional data
const { data, error } = await supabaseAdmin
  .from("citizens")
  .insert({
    citizen_id: authData.user.id,
    full_name: fullName,
    email,
  })
  .select()
  .single();
```

---

### User Login

**MySQL:**

```typescript
const [rows] = await pool.query("SELECT * FROM citizens WHERE email = ?", [
  email,
]);
const user = rows[0];
const isValid = await bcrypt.compare(password, user.password_hash);
```

**Supabase:**

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error) throw error;

// Get additional user data
const { data: userData } = await supabaseAdmin
  .from("citizens")
  .select("*")
  .eq("citizen_id", data.user.id)
  .single();
```

---

## 🔄 Transactions

**MySQL:**

```typescript
const connection = await pool.getConnection();
await connection.beginTransaction();

try {
  await connection.query("INSERT INTO reports ...");
  await connection.query("INSERT INTO report_evidence ...");
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

**Supabase:**

```typescript
// Use PostgreSQL transactions via RPC
const { data, error } = await supabaseAdmin.rpc("create_report_with_evidence", {
  report_data: { title, description },
  evidence_data: { file_url, file_type },
});

// Or create a PostgreSQL function in Supabase SQL Editor:
/*
CREATE OR REPLACE FUNCTION create_report_with_evidence(
  report_data jsonb,
  evidence_data jsonb
)
RETURNS json AS $$
DECLARE
  new_report_id int;
  result json;
BEGIN
  INSERT INTO reports (title, description)
  VALUES (report_data->>'title', report_data->>'description')
  RETURNING report_id INTO new_report_id;
  
  INSERT INTO report_evidence (report_id, file_url, file_type)
  VALUES (new_report_id, evidence_data->>'file_url', evidence_data->>'file_type');
  
  SELECT json_build_object('report_id', new_report_id) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
*/
```

---

## 📊 Aggregation Queries

**MySQL:**

```typescript
const [rows] = await pool.query(`
  SELECT 
    category,
    COUNT(*) as count,
    AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_resolution_hours
  FROM reports
  WHERE status = 'Resolved'
  GROUP BY category
`);
```

**Supabase:**

```typescript
// Create a database function for complex aggregations
const { data, error } = await supabaseAdmin.rpc("get_category_stats");

// Or use PostgREST aggregation:
const { data, error } = await supabaseAdmin
  .from("reports")
  .select("category, count:report_id.count()")
  .eq("status", "Resolved")
  .group("category");
```

---

## 🗺️ Geospatial Queries

### Find Reports Near Location

**MySQL:**

```typescript
const [rows] = await pool.query(
  `
  SELECT *, 
    (6371 * acos(cos(radians(?)) * cos(radians(location_lat)) 
    * cos(radians(location_lng) - radians(?)) 
    + sin(radians(?)) * sin(radians(location_lat)))) AS distance
  FROM reports
  HAVING distance < ?
  ORDER BY distance
`,
  [lat, lng, lat, radiusKm]
);
```

**Supabase (with PostGIS):**

```typescript
// First, create a PostgreSQL function:
/*
CREATE OR REPLACE FUNCTION nearby_reports(
  lat float,
  lng float,
  radius_meters float
)
RETURNS TABLE (
  report_id int,
  title varchar,
  distance float
) AS $$
  SELECT 
    report_id,
    title,
    ST_Distance(location_geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) as distance
  FROM reports
  WHERE ST_DWithin(
    location_geom,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  ORDER BY distance;
$$ LANGUAGE sql;
*/

// Then call it from your code:
const { data, error } = await supabaseAdmin.rpc("nearby_reports", {
  lat: 14.5547,
  lng: 121.0244,
  radius_meters: 5000,
});
```

---

## 🎯 Important Notes

### When to use `supabase` vs `supabaseAdmin`

- **`supabase`**: For client-facing operations (respects RLS policies)
- **`supabaseAdmin`**: For server-side operations (bypasses RLS)

### Error Handling

Always check for errors:

```typescript
const { data, error } = await supabaseAdmin.from("reports").select("*");

if (error) {
  console.error("Database error:", error.message);
  throw new Error("Failed to fetch reports");
}

// data is now guaranteed to exist
return data;
```

### TypeScript Support

Define your types:

```typescript
interface Report {
  report_id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

const { data, error } = await supabaseAdmin
  .from("reports")
  .select("*")
  .returns<Report[]>();
```

---

## 🚀 Next Steps

1. ✅ Review this cheat sheet
2. ✅ Start with simple SELECT queries
3. ✅ Test each conversion with real data
4. ✅ Use Supabase SQL Editor to test complex queries
5. ✅ Run K6 tests after each major change

Good luck with your migration! 💪
