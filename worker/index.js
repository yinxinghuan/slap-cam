const SESSION_ID = 'bf777cd4-3afe-48ad-8d98-7df28610a14b';

/** Frontend-only session handler used by the AlterU self-hosted deployer. */
export async function handleApi(request) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname.endsWith('/api/health')) {
    return Response.json({
      ok: true,
      game: 'slap-cam',
      sessionId: SESSION_ID,
      mode: 'frontend-only',
    });
  }
  return new Response('Not Found', { status: 404 });
}
