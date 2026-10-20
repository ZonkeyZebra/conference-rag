import json
from supabase import create_client

with open("config.public.json", encoding="utf-8") as f:
    public = json.load(f)

client = create_client(
    public["SUPABASE_URL"],
    public["SUPABASE_ANON_KEY"],  # Use the anon key only—never the service key
)

page_views = client.table("page_views").select("id").limit(5).execute()
print(f"page_views query succeeded; returned {len(page_views.data)} rows")

embeddings = client.table("sentence_embeddings").select("id").limit(5).execute()
print(
    f"sentence_embeddings returned {len(embeddings.data)} rows "
    "(expected: 0 for an unauthenticated request)"
)
