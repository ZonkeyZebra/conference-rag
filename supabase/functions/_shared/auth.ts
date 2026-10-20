export type AuthResult =
  | { authenticated: true }
  | { authenticated: false; status: 401 | 500 | 503; error: string };

export async function verifySupabaseUser(
  request: Request,
): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable");
    return {
      authenticated: false,
      status: 500,
      error: "Function authentication is not configured",
    };
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return {
      authenticated: false,
      status: 401,
      error: "A valid bearer token is required",
    };
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: authorization,
      },
    });
  } catch (error) {
    console.error("Supabase Auth request failed:", error);
    return {
      authenticated: false,
      status: 503,
      error: "Authentication service is unavailable",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      authenticated: false,
      status: 401,
      error: "A valid bearer token is required",
    };
  }

  if (!response.ok) {
    console.error(`Supabase Auth returned HTTP ${response.status}`);
    return {
      authenticated: false,
      status: 503,
      error: "Authentication service is unavailable",
    };
  }

  return { authenticated: true };
}
