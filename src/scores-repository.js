export function createScoresRepository({ supabaseUrl, publishableKey, fetchImpl = fetch }) {
  const endpoint = new URL("/rest/v1/scores", supabaseUrl);

  async function request({ method = "GET", query, body } = {}) {
    const url = new URL(endpoint);
    if (query) {
      url.search = query.toString();
    }

    const headers = { apikey: publishableKey };
    const options = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetchImpl(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed (${response.status}): ${errorText}`);
    }

    return response;
  }

  return {
    async listTop(limit = 10) {
      const query = new URLSearchParams({
        select: "player_name,score,level,created_at",
        order: "score.desc,created_at.asc",
        limit: String(limit)
      });
      const response = await request({ query });
      return response.json();
    },

    async addScore(score) {
      await request({ method: "POST", body: score });
    }
  };
}