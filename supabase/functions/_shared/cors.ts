// Shared CORS headers for all MyFatoorah Edge Functions.
// The frontend calls these via supabase.functions.invoke(), which sends a
// preflight OPTIONS request from the browser — this must be handled or
// every call fails with a CORS error before it even reaches the function body.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
