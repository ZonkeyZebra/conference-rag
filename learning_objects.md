# Learning Objectives: What They Mean and How This Project Uses Them

This guide connects each learning objective in the Conference RAG project to
the code and data flow that implements it.

## 1. Vector Embeddings

**What they are:** A vector embedding is a list of numbers generated from text
by a machine-learning model. The numbers encode patterns in the text, so texts
with related meaning often have vectors that are close to one another. An
embedding is a representation, not a human-readable definition of the text.

**How this project uses them:**

- `scripts/03_import_data.py` splits each talk into sentence records and keeps
  metadata such as its title, speaker, year, season, URL, and position in the
  talk.
- `scripts/04_embed_data.py` sends those sentences to OpenAI's
  `text-embedding-3-small` model, producing 1,536-dimensional vectors.
- `scripts/05_update_embeddings.py` writes those vectors into the
  `embedding vector(1536)` column in Supabase's `sentence_embeddings` table.
- At search time, the `embed-question` Edge Function uses the same embedding
  model and returns a vector for the user's question.

**Why it matters:** The database can compare the question vector to stored
sentence vectors, allowing retrieval based on related ideas rather than only
matching exact words.

## 2. Semantic Search

**What it is:** Semantic search finds content related in meaning, including
when a query and a passage use different wording. This project compares vectors
using cosine distance. It is useful for paraphrases and conceptual queries,
but it is not guaranteed to understand intent correctly.

**How this project uses it:**

1. The browser sends the query to `embed-question`.
2. The browser passes the returned embedding to Supabase's
   `match_sentences()` database function.
3. The function orders sentences using pgvector's cosine-distance operator,
   `<=>`, and returns the closest matches. Smaller cosine distance means more
   similar vectors.
4. The app displays those matching sentences with their talk metadata.

Keyword search and semantic search solve related but different problems.
`ILIKE` is useful for exact terms and quotations; vector search may find a
relevant passage that uses synonyms or different phrasing. The project uses an
HNSW index with `vector_cosine_ops` so PostgreSQL can efficiently search by
cosine distance as the embedding table grows.

## 3. RAG Architecture

**What it is:** Retrieval-Augmented Generation (RAG) combines document
retrieval with a language model. The application retrieves relevant source
material for a question and provides that material to the model as context for
generating an answer.

**How this project uses it:**

1. The question is embedded and compared with conference-talk sentence
   embeddings.
2. The closest sentences are grouped by `talk_id`, and the app selects the
   most relevant talks.
3. It fetches the selected talks' full text to provide richer context.
4. The browser calls the `generate-answer` Edge Function with the question and
   talk context.
5. The function asks GPT-4o to answer using that context and cite the talk
   titles and speakers.
6. The app displays the answer and links to the source talks.

RAG fits this project because the talks are a specific collection of source
documents that can be updated without retraining a language model. Retrieval
can still miss relevant material, and a model can misread context, so generated
answers and citations should be checked against the original talks.

## 4. Edge Functions

**What they are:** Edge Functions are server-side functions hosted by Supabase.
They can receive requests from a browser, perform trusted work, and return a
result without putting private API credentials in downloadable client code.

**How this project uses them:**

- `embed-question` accepts a question, verifies the caller's Supabase access
  token, calls OpenAI's embeddings API using the server-side
  `OPENAI_API_KEY`, and returns the embedding.
- `generate-answer` verifies the caller, sends the question and retrieved talk
  context to GPT-4o using the same server-side secret, and returns the answer.
- Shared helpers provide CORS handling and validate user tokens with Supabase
  Auth.
- The function deployment uses `--no-verify-jwt` because the functions perform
  token verification themselves.

The browser can be inspected by anyone, so an OpenAI key placed in its
JavaScript could be copied and abused. Keeping the key in Supabase Function
secrets keeps it server-side. Authentication verifies who is making a request;
input validation, authorization, and usage limits are still important to
prevent misuse and unexpected costs.

## 5. Row Level Security (RLS)

**What it is:** RLS is PostgreSQL's row-level authorization mechanism. Once
enabled on a table, policies determine which rows a database role can select,
insert, update, or delete. It enforces access in the database instead of
depending only on the browser application to hide data.

**How this project uses it:**

- RLS is enabled on `sentence_embeddings`.
- Its SELECT policy is for the `authenticated` role, so logged-in users can
  read the conference material while unauthenticated `anon` requests cannot.
- The `page_views` table has separate policies allowing public reads and
  inserts for the application's page-view counter demonstration.
- Setup and import scripts use the service-role key in trusted local
  environments; that privileged key bypasses RLS and must not be put in
  browser code or committed.

The anon key is visible in the browser by design; RLS and database grants
control what its requests can access. Policies must be designed carefully:
the project's authenticated read policy allows every authenticated user to
read all rows in the shared conference-talk table. That is appropriate for
this shared dataset, but it would not provide per-user isolation for private
records.

## 6. Production Deployment

**What it is:** Production deployment means making an application available
outside a developer's computer and connecting the deployed pieces in a way
that users can actually access.

**How this project uses it:**

- The frontend is a static HTML, CSS, and JavaScript site deployed through
  GitHub Pages.
- GitHub Pages provides HTTPS for the public website.
- `config.public.json` supplies the browser with the Supabase project URL and
  anon key.
- Supabase hosts authentication, the PostgreSQL database with pgvector, and
  the Edge Functions.
- Supabase Auth sends magic links and returns a user session. The browser uses
  that session to access authenticated features and invoke the functions.
- The OpenAI key is configured as a Supabase Function secret rather than
  committed with the site.

This gives the project a real deployed frontend and managed backend, while
demonstrating patterns used in production systems. It is still an educational
application: deployment alone does not guarantee production readiness.
Production systems also need appropriate rate limits, monitoring, error
handling, access policies, backups, and testing.

## End-to-End Flow

```text
Talk pages
  -> scraper and sentence splitting
  -> embeddings stored in Supabase / pgvector

User's browser on GitHub Pages
  -> Supabase Auth session
  -> embed-question Edge Function -> question embedding
  -> match_sentences() -> relevant sentence and talk retrieval
  -> generate-answer Edge Function -> cited answer
  -> display answer and source links
```

## Project References

- [Project README](./README.md)
- [Schema and RLS guide](./steps/03_database_schema.md)
- [Scrape and import guide](./steps/04_scrape_and_import.md)
- [Embeddings and semantic search guide](./steps/05_embeddings.md)
- [RAG guide](./steps/06_rag.md)
- [Schema creation script](./scripts/01_create_schema.py)
- [Sentence import script](./scripts/03_import_data.py)
- [Embedding generation script](./scripts/04_embed_data.py)
- [Embedding import script](./scripts/05_update_embeddings.py)
- [Application search and RAG flow](./app.js)
