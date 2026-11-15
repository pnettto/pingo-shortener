-- JSON array of allowed browser origins, e.g. ["https://myapp.com","https://*.myapp.com"]. NULL = server-only key.
ALTER TABLE api_keys ADD COLUMN origins TEXT;
