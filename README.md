<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.3-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/TimescaleDB-Latest-2ED573?style=for-the-badge" alt="TimescaleDB">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis" alt="Redis">
  <img src="https://img.shields.io/badge/MQTT-Mosquitto-660066?style=for-the-badge&logo=mqtt" alt="MQTT">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/Firebase-FCM-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase">
</p>

<h1 align="center">SISMOVIGIA - SiMex</h1>

<p align="center">
  <strong>Panel de Monitoreo Sismologico en Tiempo Real</strong><br>
  <em> - Fuentes oficiales reales - IoT distribuido</em>
</p>

## Descripcion

**SISMOVIGIA** es un sistema de monitoreo sismico para México que consume fuentes oficiales reales (SSN-UNAM y USGS), persiste en una base de datos de series de tiempo (PostgreSQL + TimescaleDB) y entrega eventos en tiempo real por WebSocket. Incluye una capa de sensores IoT distribuidos que transmiten telemetria por MQTT, con notificaciones push via Firebase Cloud Messaging.

