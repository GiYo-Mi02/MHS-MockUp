"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const supabase_1 = require("../src/supabase");
async function main() {
    const sql = (0, fs_1.readFileSync)(path_1.default.join(process.cwd(), 'scripts', 'seed.sql'), 'utf-8');
    const statements = sql
        .split(/;\s*(?:\r?\n|$)/g)
        .map((stmt) => stmt.trim())
        .filter(Boolean);
    for (const statement of statements) {
        await supabase_1.pool.query(statement);
    }
    console.log('Seed applied');
    process.exit(0);
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=db-seed.js.map