import psycopg2
from collections import defaultdict

old_url = 'postgresql://keiba_database_user:kRhHHHeIdx5Pw9LzkbA8HCLLKAg20XDm@dpg-d1gd9ajipnbc73aj1nlg-a.oregon-postgres.render.com/keiba_db'
new_url = 'postgresql://neondb_owner:npg_0kOPvcxAU4bg@ep-hidden-fog-aksj4thi-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require'

def get_counts(url):
    counts = {}
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = [r[0] for r in cur.fetchall()]
        for table in tables:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            counts[table] = cur.fetchone()[0]
        conn.close()
    except Exception as e:
        print(f'Error connecting: {e}')
    return counts

print("Fetching from old DB...")
old_counts = get_counts(old_url)
print("Fetching from new DB...")
new_counts = get_counts(new_url)

print(f"{'Table Name':<30} | {'Old DB':<10} | {'New DB':<10}")
print('-' * 60)
all_tables = set(old_counts.keys()) | set(new_counts.keys())
for tbl in sorted(all_tables):
    o = old_counts.get(tbl, 'MISSING')
    n = new_counts.get(tbl, 'MISSING')
    match = 'O' if str(o) == str(n) else 'X'
    print(f"{tbl:<30} | {str(o):<10} | {str(n):<10} {match}")
