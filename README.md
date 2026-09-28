# Server Status Alarm

A personal **"notify me when it's back up"** web tool.

Enter a URL and the application continuously checks the server every **30 seconds**. When the server becomes available and **2 consecutive checks succeed**, an alarm plays in the browser and a full-screen notification appears.

## Features

* Monitor publicly accessible URLs
* Automatic health checks every 30 seconds
* Requires 2 consecutive successful checks before triggering the alarm
* Browser alarm when the server is back online
* Real-time updates using Server-Sent Events (SSE)
* SSRF protection against localhost and private IP addresses
* SQLite database for storing monitored URLs
* Automatic 24-hour watch expiry
* Delete monitored URLs
* Dark-themed responsive interface

## Architecture

```text
                  +------------------+
                  |    Browser UI    |
                  |   HTML/CSS/JS   |
                  +--------+---------+
                           |
                     POST /api/watch
                           |
                           v
                  +------------------+
                  |  Express Server  |
                  |    server.js     |
                  +--------+---------+
                           |
                +----------+----------+
                |                     |
                v                     v
        +---------------+     +---------------+
        |    SQLite     |     |    Checker    |
        |     db.js     |     |   checker.js  |
        +---------------+     +-------+-------+
                                      |
                               Every 30 seconds
                                      |
                                      v
                              +---------------+
                              |   Target URL  |
                              +-------+-------+
                                      |
                              2 successful checks
                                      |
                                      v
                              +---------------+
                              |   SSE Event   |
                              |   -> Browser  |
                              +---------------+
```

## Project Structure

```text
SERVER CHECK/
|
├── package.json
├── package-lock.json
├── server.js
├── db.js
├── checker.js
├── ssrf.js
│
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## File Description

| File                | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `package.json`      | Project dependencies and npm scripts                      |
| `server.js`         | Express server, API routes, SSE, and static file serving  |
| `db.js`             | SQLite database setup and prepared statements             |
| `checker.js`        | URL polling engine and SSE status broadcasting            |
| `ssrf.js`           | Prevents monitoring of localhost and private IP addresses |
| `public/index.html` | Main user interface                                       |
| `public/style.css`  | Dark-themed interface styling                             |
| `public/app.js`     | Frontend logic and browser alarm                          |

## Requirements

* Node.js
* npm
* Internet connection

## Installation

Clone the repository:

```bash
git clone https://github.com/punitrajendra/SERVER-UP-ALARAM.git
```

Move into the project directory:

```bash
cd SERVER-UP-ALARAM
```

Install dependencies:

```bash
npm install
```

## Running the Project

Start the development server:

```bash
npm run dev
```

Open the application in your browser:

```text
http://localhost:3000
```

Paste the URL you want to monitor and click **Start Watching**.

The application will check the target server every 30 seconds.

When the server returns successful responses for two consecutive checks, the browser alarm will trigger and the interface will display:

```text
SERVER IS UP!
```

## API Endpoints

### Get All Watches

```http
GET /api/watches
```

Returns all currently monitored URLs.

Example response:

```json
[]
```

### Create a Watch

```http
POST /api/watch
```

Creates a new URL monitoring task.

### Delete a Watch

```http
DELETE /api/watch/:id
```

Removes an existing monitoring task.

### Server-Sent Events

```http
GET /api/events
```

Provides real-time status updates from the server to the browser.

## Security

The application includes SSRF protection.

URLs pointing to localhost, loopback addresses, and private IP addresses are rejected.

For example:

```text
http://localhost:3000
```

is rejected with:

```text
Cannot monitor localhost or loopback addresses
```

This prevents the monitoring service from being used to access internal services.

## Test Results

| Test                                       | Result |
| ------------------------------------------ | ------ |
| `GET /api/watches` with empty database     | Passed |
| `POST /api/watch` with valid URL           | Passed |
| Localhost SSRF protection                  | Passed |
| Server returning HTTP 500 detected as down | Passed |
| `DELETE /api/watch/:id`                    | Passed |
| 24-hour automatic expiry                   | Passed |

## Monitoring Logic

The checker runs every 30 seconds.

A server is considered back online only after **2 consecutive successful checks**.

Example:

```text
Check 1: Failed
Status: Down

Check 2: Successful
Status: Checking

Check 3: Successful
Status: Up

Alarm: Triggered
```

This helps prevent false alarms caused by a temporary successful response.

## Future Improvements

* Telegram notifications
* Web Push notifications
* Notifications when the browser tab is closed
* Page content or text matching
* Custom polling intervals
* Monitoring history
* Response-time tracking
* Multiple notification channels
* User authentication
* Deployment to a cloud platform

## License

This project is for personal and educational use.
