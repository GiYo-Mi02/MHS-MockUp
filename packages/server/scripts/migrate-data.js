/**
 * MySQL to PostgreSQL Data Migration Script
 *
 * This script converts MySQL dump syntax to PostgreSQL-compatible syntax.
 * It handles common differences like AUTO_INCREMENT, ENUM values, etc.
 */

const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "data_export.sql");
const outputFile = path.join(__dirname, "data_export_postgres.sql");

console.log("🔄 Converting MySQL dump to PostgreSQL format...\n");

// Check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error("❌ Error: data_export.sql not found!");
  console.log("Please run this first:");
  console.log(
    "mysqldump -u root -p --no-create-info --skip-triggers makati_report > scripts/data_export.sql"
  );
  process.exit(1);
}

// Read the MySQL dump
let sqlContent = fs.readFileSync(inputFile, "utf8");

console.log("📝 Applying conversions...\n");

// 1. Remove MySQL-specific comments and metadata
sqlContent = sqlContent.replace(/\/\*![\s\S]*?\*\/;/g, "");
sqlContent = sqlContent.replace(/-- phpMyAdmin[\s\S]*?-- PHP Version:.*?\n/g, "");
sqlContent = sqlContent.replace(/-- Host:.*?\n/g, "");
sqlContent = sqlContent.replace(/-- Generation Time:.*?\n/g, "");
sqlContent = sqlContent.replace(/-- Server version:.*?\n/g, "");

// 2. Remove SET statements and START TRANSACTION
sqlContent = sqlContent.replace(/SET[\s\S]*?;/g, "");
sqlContent = sqlContent.replace(/START TRANSACTION;/gi, "");

// 3. Remove CREATE TABLE statements (we already have the schema in migrations)
sqlContent = sqlContent.replace(/CREATE TABLE[^;]+;/gi, "");
sqlContent = sqlContent.replace(/CREATE TABLE[\s\S]*?ENGINE=InnoDB[^;]*;/gi, "");

// 4. Remove all ENGINE, DEFAULT CHARSET declarations
sqlContent = sqlContent.replace(/\) ENGINE=[\s\S]*?;/gi, ";");

// 5. Remove ALTER TABLE structure modifications (keep only data INSERTs)
sqlContent = sqlContent.replace(/ALTER TABLE.*?ADD PRIMARY KEY.*?;/gi, "");
sqlContent = sqlContent.replace(/ALTER TABLE.*?ADD UNIQUE KEY.*?;/gi, "");
sqlContent = sqlContent.replace(/ALTER TABLE.*?ADD KEY.*?;/gi, "");
sqlContent = sqlContent.replace(/ALTER TABLE.*?MODIFY.*?;/gi, "");
sqlContent = sqlContent.replace(/ALTER TABLE.*?ADD CONSTRAINT.*?;/gi, "");

// 6. Remove section comments
sqlContent = sqlContent.replace(/--\s*Indexes for.*?\n/gi, "");
sqlContent = sqlContent.replace(/--\s*Constraints for.*?\n/gi, "");
sqlContent = sqlContent.replace(/--\s* for dumped tables.*?\n/gi, "");
sqlContent = sqlContent.replace(/--\s* for table.*?\n/gi, "");
sqlContent = sqlContent.replace(/--\s*Table structure for.*?\n/gi, "");
sqlContent = sqlContent.replace(/--\s*Dumping data for.*?\n/gi, "");
sqlContent = sqlContent.replace(/--\s*Database:.*?\n/gi, "");
sqlContent = sqlContent.replace(/-- -+\n/g, "");

// 7. Replace backticks with nothing (PostgreSQL doesn't need them)
sqlContent = sqlContent.replace(/`/g, "");

// 8. Fix data types - remove MySQL size specifications
sqlContent = sqlContent.replace(/int\(\d+\)/gi, "INTEGER");
sqlContent = sqlContent.replace(/tinyint\(\d+\)/gi, "SMALLINT");

// 9. Convert MySQL boolean values (0/1) to PostgreSQL (false/true)
// Be careful with commas and parentheses
sqlContent = sqlContent.replace(/VALUES\s*\(([^)]*?)\s+0\s*,/gi, (match, p1) => {
  return `VALUES (${p1} false,`;
});
sqlContent = sqlContent.replace(/VALUES\s*\(([^)]*?)\s+1\s*,/gi, (match, p1) => {
  return `VALUES (${p1} true,`;
});
sqlContent = sqlContent.replace(/,\s*0\s*,/g, ", false,");
sqlContent = sqlContent.replace(/,\s*1\s*,/g, ", true,");
sqlContent = sqlContent.replace(/,\s*0\s*\)/g, ", false)");
sqlContent = sqlContent.replace(/,\s*1\s*\)/g, ", true)");

// 10. Replace MySQL date format with NULL
sqlContent = sqlContent.replace(/'0000-00-00 00:00:00'/g, "NULL");

// 11. Remove CHECK constraints from data inserts
sqlContent = sqlContent.replace(/CHECK\s*\([^)]+\)/gi, "");

// 12. Clean up INSERT statements
sqlContent = sqlContent.replace(/INSERT INTO "(\w+)"/gi, "INSERT INTO $1");
sqlContent = sqlContent.replace(/INSERT INTO\s+"(\w+)"/gi, "INSERT INTO $1");

// 13. Remove LOCK/UNLOCK TABLES
sqlContent = sqlContent.replace(/LOCK TABLES[\s\S]*?UNLOCK TABLES;/g, "");

// 14. Clean up multiple empty lines
sqlContent = sqlContent.replace(/\n\n\n+/g, "\n\n");

// 15. Remove any remaining MySQL-specific syntax
sqlContent = sqlContent.replace(/GENERATED ALWAYS AS.*?STORED/gi, "");

// 9. Add sequence reset commands for SERIAL columns
const tables = [
  "departments",
  "citizens",
  "admins",
  "department_staff",
  "sla_policies",
  "reports",
  "report_evidence",
  "report_status_logs",
  "notifications",
];

const sequenceResets = tables
  .map((table) => {
    const idColumn =
      table === "departments"
        ? "department_id"
        : table === "citizens"
          ? "citizen_id"
          : table === "admins"
            ? "admin_id"
            : table === "department_staff"
              ? "staff_id"
              : table === "sla_policies"
                ? "sla_id"
                : table === "reports"
                  ? "report_id"
                  : table === "report_evidence"
                    ? "evidence_id"
                    : table === "report_status_logs"
                      ? "log_id"
                      : "notification_id";

    return `SELECT setval('${table}_${idColumn}_seq', (SELECT MAX(${idColumn}) FROM ${table}));`;
  })
  .join("\n");

// 10. Add transaction wrapper for safety
const finalContent = `
-- PostgreSQL Data Migration
-- Converted from MySQL dump
-- Generated: ${new Date().toISOString()}

BEGIN;

-- Disable triggers during import
SET session_replication_role = replica;

${sqlContent}

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Reset sequences to correct values
${sequenceResets}

COMMIT;

-- Verify import
DO $$
DECLARE
  table_name TEXT;
  row_count INT;
BEGIN
  RAISE NOTICE 'Data Import Summary:';
  RAISE NOTICE '=====================';
  
  FOR table_name IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
    RAISE NOTICE '%: % rows', table_name, row_count;
  END LOOP;
END $$;
`;

// Write the converted file
fs.writeFileSync(outputFile, finalContent, "utf8");

console.log("✅ Conversion complete!\n");
console.log("📄 Output file: " + outputFile);
console.log("\nNext steps:");
console.log("1. Review the generated file for any issues");
console.log("2. Import to Supabase:");
console.log("   - Option A: Copy content and paste into Supabase SQL Editor");
console.log("   - Option B: Use psql command:");
console.log(
  '     psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres" < scripts/data_export_postgres.sql'
);
console.log("\n🎉 Ready to import!");
