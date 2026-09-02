/** Minimal fake req/res for calling Vercel-style (req, res) handlers directly in tests. */
export function fakeReq({ method = 'GET', body = {}, headers = {}, query = {} } = {}) {
  return { method, body, headers, query };
}

export function fakeRes() {
  const res = {
    statusCode: 200,
    _json: undefined,
    _headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      // Round-trip through JSON exactly like a real HTTP response body
      // would (Vercel's res.json() calls JSON.stringify internally) —
      // e.g. this turns a raw pg Date object into the same ISO string
      // a real client would receive, instead of leaking a Date past
      // the handler boundary that production callers never see.
      this._json = JSON.parse(JSON.stringify(obj));
      return this;
    },
    setHeader(name, value) {
      this._headers[name] = value;
    },
    end() {
      return this;
    },
  };
  return res;
}
