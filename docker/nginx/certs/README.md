Place production TLS certificates here before starting `docker-compose.prod.yml`:

- `fullchain.pem`
- `privkey.pem`

For managed hosts, mount the certificate directory into this path instead of committing private keys.
