# TaskFlow API

A simple REST API for managing tasks with user authentication.

## Features

- User registration
- User login
- JWT authentication
- Create tasks
- View tasks
- Update tasks
- Delete tasks
- Users can only access their own tasks

## Authentication

After logging in, the server returns a JWT access token.

Protected endpoints require:

Authorization: Bearer <token>

## API Endpoints

### Authentication

POST /auth/signup
Creates a new user.

POST /auth/login
Authenticates a user and returns a JWT.

GET /auth/me
Returns the currently authenticated user.

### Tasks

GET /tasks
Returns the authenticated user's tasks.

POST /tasks
Creates a task for the authenticated user.

GET /tasks/:id
Returns a specific task.

PUT /tasks/:id
Updates a task.

DELETE /tasks/:id
Deletes a task.
