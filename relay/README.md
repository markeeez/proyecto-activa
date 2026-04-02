# Relay FatSecret (servidor con IP fija)

Supabase Edge Functions salen por IPs dinámicas; FatSecret puede exigir lista blanca. Este relay corre en tu **Hetzner** (`bot-deportivo-1`, p. ej. `178.104.110.6`): FatSecret solo ve la IP del VPS.

## ¿Hace falta comprar un dominio?

**No.** Para desarrollo y pruebas puedes usar solo la IP y HTTP:

- **`FATSECRET_RELAY_URL`** = `http://178.104.110.6:8787` (solo host + puerto, **sin** `/relay`; la Edge Function ya añade `/relay` sola).
- Abre el puerto **8787** TCP en el **firewall de Hetzner** (Cloud → Firewalls o reglas del servidor) hacia `0.0.0.0/0` o solo cuando pruebes.

Un **dominio** sirve para **HTTPS** (cifrado entre Supabase y tu VPS) y URLs más limpias; no es obligatorio para que funcione. Puedes usar un dominio que ya tengas o añadir uno más adelante con Caddy/Let’s Encrypt.

**Secreto en Supabase:** el nombre correcto es `FATSECRET_RELAY_SECRET` (con **T** al final), no `RELAY_SECRETE`.

## 1. FatSecret

En [platform.fatsecret.com](https://platform.fatsecret.com) → tu clave OAuth → **Allowed IP addresses** → añade la IP pública del servidor:

- **178.104.110.6** (la de la captura), o la **Floating IP** si usas una en Hetzner.

Si cambias de IP, actualiza FatSecret y espera hasta ~1 h.

## 2. Subir el relay al VPS

Desde tu PC (con `scp` o SFTP), copia `relay/fatsecret-relay.mjs` al servidor, por ejemplo:

```bash
scp relay/fatsecret-relay.mjs root@178.104.110.6:/opt/fatsecret-relay/
```

En el servidor:

```bash
sudo mkdir -p /opt/fatsecret-relay
# coloca ahí fatsecret-relay.mjs
sudo apt update && sudo apt install -y nodejs  # o Node 18+ desde NodeSource
```

Genera un secreto largo (el mismo luego irá a Supabase):

```bash
openssl rand -hex 32
```

Crea `/etc/fatsecret-relay.env` (permisos restrictivos):

```bash
sudo bash -c 'echo "RELAY_SECRET=Pega_aqui_el_hex_de_openssl" > /etc/fatsecret-relay.env'
sudo chmod 600 /etc/fatsecret-relay.env
```

Prueba en foreground:

```bash
cd /opt/fatsecret-relay
export $(sudo cat /etc/fatsecret-relay.env | xargs)
export PORT=8787
node fatsecret-relay.mjs
```

En otra terminal del VPS:

```bash
curl -s http://127.0.0.1:8787/health   # debe responder: ok
```

## 3. Exponer el relay a internet

Supabase debe poder hacer `POST` a tu relay desde fuera (no desde tu móvil directamente).

**Opción A – Solo IP (HTTP), sin dominio**

1. Firewall Hetzner: permitir **entrante** TCP **8787** (origen `0.0.0.0/0` o restringido si prefieres).
2. En systemd, `BIND=0.0.0.0` (o sin `BIND`) para escuchar en todas las interfaces.
3. En Supabase: `FATSECRET_RELAY_URL=http://178.104.110.6:8787`

Con HTTP+IP el tráfico va en claro hasta tu VPS; mitiga con **RELAY_SECRET** largo (`openssl rand -hex 32`) y cerrando el puerto 8787 en el firewall cuando no lo uses.

**Opción B – Dominio + HTTPS (recomendado a largo plazo)**

Supabase puede llamar a `POST https://tu-dominio/relay` con tráfico cifrado.

**Opción B1 – Ya tienes dominio apuntando al VPS**

Instala Caddy (certificados automáticos):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

`/etc/caddy/Caddyfile` (sustituye el host):

```caddy
fatsecret-relay.tu-dominio.com {
    reverse_proxy 127.0.0.1:8787
}
```

El servicio Node debe escuchar solo `127.0.0.1` (`BIND=127.0.0.1` en systemd). Recarga Caddy: `sudo systemctl reload caddy`.

## 4. Systemd (relay siempre activo)

Copia `fatsecret-relay.service.example` a `/etc/systemd/system/fatsecret-relay.service`, ajusta `User`, rutas y `EnvironmentFile`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fatsecret-relay
sudo systemctl status fatsecret-relay
```

## 5. Supabase (desarrollo y producción)

Secretos del proyecto:

```bash
# Sin dominio (IP fija Hetzner):
npx supabase secrets set FATSECRET_RELAY_URL="http://178.104.110.6:8787"

# Con dominio + HTTPS:
# npx supabase secrets set FATSECRET_RELAY_URL="https://fatsecret-relay.tu-dominio.com"

npx supabase secrets set FATSECRET_RELAY_SECRET="el_mismo_RELAY_SECRET_del_VPS"
npx supabase functions deploy fatsecret-search
```

Si `FATSECRET_RELAY_URL` está vacío, la función llama a FatSecret **directo** (como antes).

**Nota:** No incluyas `/relay` al final de la URL (si lo pones, la función lo quita igualmente para no generar `/relay/relay`).

## 6. Probar el relay desde tu PC

```bash
curl -s -X POST "https://fatsecret-relay.tu-dominio.com/relay" \
  -H "Content-Type: application/json" \
  -H "X-FatSecret-Relay-Secret: TU_SECRETO" \
  -d "{\"url\":\"https://oauth.fatsecret.com/connect/token\",\"method\":\"POST\",\"headers\":{\"Authorization\":\"Basic xxxx\",\"Content-Type\":\"application/x-www-form-urlencoded\"},\"body\":\"grant_type=client_credentials&scope=basic\"}"
```

(Sustituye `Basic xxxx` por el Base64 real de `client_id:client_secret`.)

Si eso devuelve JSON con `access_token`, el relay y la IP en FatSecret están bien.

## 7. Si la app sigue con 0 candidatos FatSecret

1. **Mismo camino que Supabase** desde tu PC (con las mismas variables que en secrets):

   En `.env` local añade `FATSECRET_RELAY_URL` y `FATSECRET_RELAY_SECRET` (los mismos valores que en Supabase) y ejecuta:

   ```bash
   npm run test:fatsecret -- "pollo chicken"
   ```

   Debe poner `Modo: RELAY → http://...`. Si aquí hay ítems pero la app no, el problema está en secretos/deploy de Supabase o en el JWT de la app.

2. **Logs en Metro** (`__DEV__`): tras buscar, busca la línea `fatsecret-search: cuerpo data` → verás si la función devuelve `{ "items": [] }` u otro JSON.

3. **Logs en Supabase** (Edge Function `fatsecret-search`): mensajes `relay HTTP`, `API error`, código 21, etc.

### `invalid_client` en el paso OAuth (con relay)

Ese JSON lo devuelve **FatSecret** (`oauth.fatsecret.com`), no el relay: las credenciales OAuth que llegan a FatSecret no son válidas.

- Comprueba **`FATSECRET_CLIENT_ID`** y **`FATSECRET_CLIENT_SECRET`** en `.env` (y en Supabase): mismos valores que en [platform.fatsecret.com](https://platform.fatsecret.com) (Consumer Key / Consumer Secret), sin espacios ni comillas de más.
- Vuelve a copiarlas desde el panel si hace falta.
- **Prueba sin relay:** comenta `FATSECRET_RELAY_URL` en `.env` y ejecuta `npm run test:fatsecret`. Si tu IP está en la lista blanca y el token funciona, el relay está bien y el fallo era credenciales distintas entre “modo relay” y “modo directo” en el `.env`.

Tras cambiar `fatsecret-relay.mjs` en el VPS (p. ej. trim en cabeceras), reinicia el servicio: `sudo systemctl restart fatsecret-relay`.

### La app muestra `FatSecret candidatos 0` pero `npm run test:fatsecret` con relay OK

La Edge Function de Supabase **no usa tu `.env` local**: solo **Secrets del proyecto**. Vuelve a ejecutar:

`npx supabase secrets set FATSECRET_CLIENT_ID=...` y `FATSECRET_CLIENT_SECRET=...` (los mismos que en `.env`) y `npx supabase functions deploy fatsecret-search`.

En **Logs** de `fatsecret-search` busca:

| Mensaje | Significado |
|--------|-------------|
| `relay fetch falló` | Desde Edge no llega al VPS (a veces **`http://IP` no está permitido**). Prueba **HTTPS + dominio** con Caddy. |
| `relay HTTP 401` | `FATSECRET_RELAY_SECRET` en Supabase ≠ `RELAY_SECRET` del VPS. |
| `OAuth token falló` / `invalid_client` | ID/secret de FatSecret mal en **Supabase** (no en tu PC). |
| `Código 21` | FatSecret no autoriza la IP: sin relay, la IP es la de Supabase; con relay, debe estar la del **VPS**. |
| `Lista vacía (parse)` | JSON distinto al esperado; las claves en el log ayudan a depurar. |
| `código 14` / `premier` | La API **v3** exige plan Premier; con `scope=basic` la función pasa automáticamente a **v1** (ya corregido en `fatsecret-search`). |
