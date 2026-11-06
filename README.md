# QISMA

**QISMA** is a full-stack web application that simplifies the management of shared expenses
and debt settlement within groups such as roommates, students, families, and friends.

## Features
- User authentication with Spring Security and JWT
- Group creation, member invitations (email, link, or code), and role management
- Expense tracking with categories and multiple split methods
  (equal, custom amount, percentage)
- Automatic balance calculation (Total Paid − Total Share)
- Optimized debt settlement suggestions with support for partial repayments
- Full transaction history and activity logs
- Dashboard with statistics and charts
- In-app notifications
- Financial integrity: amounts stored as integer minor units, rounding handled
  precisely, and the sum of all balances always equal to zero

## Tech Stack
**Frontend:** React, TypeScript, React Router, Axios, Tailwind CSS, Recharts
**Backend:** Java, Spring Boot, Spring Security, JWT, Spring Data MongoDB
**Database:** MongoDB
**Tools:** Maven, Git/GitHub, Postman, Swagger/OpenAPI, Docker

## Default Currency
MAD (Moroccan Dirham), with an architecture designed to support additional currencies.
