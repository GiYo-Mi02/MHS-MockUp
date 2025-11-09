"use strict";
/**
 * Quick Database Seeder for Testing
 * Run this to seed departments if they don't exist
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_1 = require("../src/supabase");
async function seedDepartments() {
    console.log('🌱 Seeding departments...');
    const departments = [
        {
            name: 'Sanitation',
            code: 'GARBAGE',
            description: 'Handles waste management and cleanliness',
            contact_email: 'sanitation@makati.gov',
            contact_number: '02-888-1001'
        },
        {
            name: 'Traffic Management',
            code: 'TRAFFIC',
            description: 'Manages road traffic incidents and violations',
            contact_email: 'traffic@makati.gov',
            contact_number: '02-888-1002'
        },
        {
            name: 'Public Safety',
            code: 'SAFETY',
            description: 'Responds to emergencies and safety concerns',
            contact_email: 'safety@makati.gov',
            contact_number: '02-888-1003'
        },
        {
            name: 'Infrastructure',
            code: 'ROADS',
            description: 'Maintains roads and public works',
            contact_email: 'infrastructure@makati.gov',
            contact_number: '02-888-1004'
        },
        {
            name: 'General Services Desk',
            code: 'OTHERS',
            description: 'Handles uncategorized citizen concerns and escalations',
            contact_email: 'support@makati.gov',
            contact_number: '02-888-1005'
        }
    ];
    // Check if departments already exist
    const { data: existing, error: checkError } = await supabase_1.supabaseAdmin
        .from('departments')
        .select('code')
        .in('code', departments.map(d => d.code));
    if (checkError) {
        console.error('❌ Error checking departments:', checkError);
        return;
    }
    const existingCodes = new Set(existing?.map(d => d.code) || []);
    const toInsert = departments.filter(d => !existingCodes.has(d.code));
    if (toInsert.length === 0) {
        console.log('✅ All departments already exist');
        console.log('   Codes:', departments.map(d => d.code).join(', '));
        return;
    }
    console.log(`📥 Inserting ${toInsert.length} missing departments...`);
    const { error: insertError } = await supabase_1.supabaseAdmin
        .from('departments')
        .insert(toInsert);
    if (insertError) {
        console.error('❌ Error inserting departments:', insertError);
        return;
    }
    console.log('✅ Departments seeded successfully!');
    console.log('   Inserted:', toInsert.map(d => d.code).join(', '));
}
async function seedSLAPolicies() {
    console.log('🌱 Seeding SLA policies...');
    const policies = [];
    const categories = ['GARBAGE', 'TRAFFIC', 'SAFETY', 'ROADS', 'OTHERS'];
    const urgencies = [
        { level: 'Critical', hours: { GARBAGE: 2, TRAFFIC: 1, SAFETY: 1, ROADS: 4, OTHERS: 4 } },
        { level: 'High', hours: { GARBAGE: 8, TRAFFIC: 4, SAFETY: 2, ROADS: 12, OTHERS: 12 } },
        { level: 'Regular', hours: { GARBAGE: 24, TRAFFIC: 12, SAFETY: 8, ROADS: 48, OTHERS: 48 } },
        { level: 'Low', hours: { GARBAGE: 48, TRAFFIC: 24, SAFETY: 24, ROADS: 72, OTHERS: 72 } }
    ];
    urgencies.forEach(urgency => {
        categories.forEach(category => {
            policies.push({
                category: category,
                urgency_level: urgency.level,
                expected_resolution_hours: urgency.hours[category]
            });
        });
    });
    // Check existing policies
    const { data: existing, error: checkError } = await supabase_1.supabaseAdmin
        .from('sla_policies')
        .select('category, urgency_level');
    if (checkError) {
        console.error('❌ Error checking SLA policies:', checkError);
        return;
    }
    const existingKeys = new Set(existing?.map(p => `${p.category}:${p.urgency_level}`) || []);
    const toInsert = policies.filter(p => !existingKeys.has(`${p.category}:${p.urgency_level}`));
    if (toInsert.length === 0) {
        console.log('✅ All SLA policies already exist');
        return;
    }
    console.log(`📥 Inserting ${toInsert.length} missing SLA policies...`);
    const { error: insertError } = await supabase_1.supabaseAdmin
        .from('sla_policies')
        .insert(toInsert);
    if (insertError) {
        console.error('❌ Error inserting SLA policies:', insertError);
        return;
    }
    console.log('✅ SLA policies seeded successfully!');
}
async function main() {
    console.log('🚀 Starting database seeding...\n');
    await seedDepartments();
    console.log('');
    await seedSLAPolicies();
    console.log('\n✨ Database seeding complete!');
    process.exit(0);
}
main().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed-departments.js.map