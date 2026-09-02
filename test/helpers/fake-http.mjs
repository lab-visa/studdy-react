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
      this._json = obj;
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
