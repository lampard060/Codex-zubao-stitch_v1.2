function ok(res, data = {}, status = 200) {
  return res.status(status).json({
    ok: true,
    data
  });
}

function fail(res, message, status = 400, details = null) {
  return res.status(status).json({
    ok: false,
    error: {
      message,
      details
    }
  });
}

module.exports = {
  ok,
  fail
};
