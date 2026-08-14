
# EduSphere LMS - Local Setup Guide

EduSphere is a NextGen Learning Management System built with React, Vite, and Tailwind CSS.

## Prerequisites

- **Node.js**: Version 18.0 or later.
- **npm**: Installed with Node.js.

## Installation

1.  **Clone or Download** this directory to your computer.
2.  Open your terminal or command prompt in the project root folder.
3.  Install all required packages:
    ```bash
    npm install
    ```

## Configuration

No external API key is required for summarization and quiz generation.

## Running Locally

To start the development server:
```bash
npm run dev
```
The terminal will provide a link (usually `http://localhost:5173`). Open it in your browser.

## Netlify + Supabase Setup

To enable authentication in Netlify deployment, add these environment variables in **Site settings → Environment variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use `.env.example` as the reference for values.

## Credentials for Testing

- **Student Role**: 
  - User ID: `user1`
  - Access Key: `123456`
- **Teacher Role**: 
  - User ID: `teacher1`
  - Access Key: `123456`

## Project Structure

- `App.tsx`: Main application logic and routing.
- `constants.tsx`: Mock data and initial configurations.
- `types.ts`: TypeScript interfaces and enums.
- `components/`: UI components like Sidebar, CourseCard, and Login.
- `services/`: local note summarization and quiz generation utilities.
