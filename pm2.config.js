module.exports = {
  apps : [{
    name   : "Automator",
    script : "./index.js",
    env: {
      "NODE_ENV"    : "production",
      "PORT"        : 5000,
      "PG_URL"      : "postgres://buble_user:%60%262%5CpFA%3B%21%2BPNCg%60Jy%5BDtu%3F@20.53.254.146:5432/bubble"
    }
  }]
}