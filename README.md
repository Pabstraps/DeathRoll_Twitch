# Deathroll Bot

Bot de Twitch para jugar Deathroll en el chat.

## Instalación

1. Instala Node.js 18 o superior.
2. En esta carpeta ejecuta:

   ```bash
   npm install
   ```

3. Copia `.env.example` a `.env` y llena tus datos:

   ```bash
   cp .env.example .env        # macOS / Linux
   copy .env.example .env      # Windows (cmd)
   ```

4. Inicia el bot:

   ```bash
   npm start
   ```

   Para reiniciar automáticamente al guardar cambios: `npm run dev`.

## Comandos

| Comando | Descripción |
|---|---|
| `!deathroll [número]` | Inicia una partida (mínimo y máximo configurables) |
| `!join` | Se une a la partida como segundo jugador |
| `!roll` | Tira en tu turno; quien saque 1 pierde |
| `!cancel` | Cancela la partida (solo mods y broadcaster) |

## Configuración (.env)

Ver `.env.example`. Los tiempos van en segundos.

## Cómo conseguir las credenciales de Twitch

El bot necesita tres datos en el `.env`:

| Variable | Qué es |
|---|---|
| `BOT_USERNAME` | Nombre de usuario de la cuenta que usará el bot |
| `TWITCH_OAUTH` | Token de acceso de esa cuenta, con el formato `oauth:xxxxxxxx` |
| `CHANNEL_NAME` | Canal donde el bot va a escuchar (sin `#`, en minúsculas) |

### 1. Elegir la cuenta del bot

Tienes dos opciones:

- **Cuenta propia del bot (recomendado):** crea una cuenta nueva en
  [twitch.tv](https://www.twitch.tv) solo para el bot (por ejemplo `tunombre_bot`).
  Así los mensajes salen con otro nombre y no con el tuyo.
- **Tu cuenta personal:** funciona igual, pero el bot escribirá como tú.

Si creas una cuenta nueva, verifica el correo, ya que Twitch puede limitar
el chat a cuentas sin verificar.

### 2. Generar el token OAuth

1. Cierra sesión en Twitch en tu navegador, o abre una ventana de incógnito,
   y entra a Twitch **con la cuenta del bot** (si no, el token se generará
   para la cuenta equivocada).
2. Abre [twitchtokengenerator.com](https://twitchtokengenerator.com).
3. Elige la opción **Bot Chat Token**.
4. Pulsa **Connect** y autoriza la aplicación en la ventana de Twitch.
5. Resuelve el captcha si te lo pide.
6. Copia el valor de **Access Token**.

En el `.env` el token debe llevar el prefijo `oauth:`:

```env
TWITCH_OAUTH=oauth:abcdef1234567890abcdef1234567890
```

El token solo necesita los permisos `chat:read` y `chat:edit`, que ya vienen
incluidos en **Bot Chat Token**.

> ⚠️ **Trata el token como una contraseña.** No lo compartas, no lo pegues
> en capturas de pantalla ni lo subas a GitHub. Si se filtra, revócalo en
> [twitch.tv/settings/connections](https://www.twitch.tv/settings/connections)
> y genera uno nuevo.

### 3. Rellenar el `.env`

```env
BOT_USERNAME=tunombre_bot
TWITCH_OAUTH=oauth:abcdef1234567890abcdef1234567890
CHANNEL_NAME=tu_canal
```

- `BOT_USERNAME` es el nombre de la cuenta con la que generaste el token.
- `CHANNEL_NAME` es el canal donde jugarán, por ejemplo `tu_canal` para
  `twitch.tv/tu_canal`.

### 4. (Opcional) Dar permisos de moderador al bot

Para que el bot no tenga límites de mensajes tan estrictos, escribe en el chat
de tu canal:

```
/mod tunombre_bot
```

También sirve para que `!cancel` y los demás comandos funcionen con fluidez
si el chat va rápido.

### Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `Login authentication failed` | El token es inválido, expiró o le falta el prefijo `oauth:`. Genera uno nuevo. |
| El bot conecta pero no responde | `CHANNEL_NAME` mal escrito, o el token es de otra cuenta distinta a `BOT_USERNAME`. |
| Los mensajes del bot no aparecen | La cuenta del bot no tiene el correo verificado, o el canal tiene el chat restringido. |
| `Faltan variables de entorno` | El archivo se llama `.env.example` en lugar de `.env`, o está en otra carpeta. |

Si el bot deja de autenticarse después de un tiempo, es normal: los tokens
pueden caducar. Repite el paso 2 y reemplaza `TWITCH_OAUTH`.

## Cómo probarlo

Necesitas dos cuentas escribiendo en el chat: tu cuenta principal y otra
(o un amigo). El bot puede correr con su propia cuenta o con la tuya.
