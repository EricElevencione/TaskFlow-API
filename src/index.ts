import express from "express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db.js";
import * as z from "zod";
import bcrypt from "bcrypt";
import "dotenv/config";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;

const app = express();
const PORT = 3000;

app.use(express.json());

// Verify the JWT and attach the authenticated user's ID
// to the request so protected routes can identify the user.
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send("No token provided");
  }

  const token = authHeader.split(" ")[1];

  if (token === undefined) {
    return res.status(401).send("Token is undefined");
  }

  if (jwtSecret == null) {
    return res.status(500).send("JWT secret is not configured");
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    const userId = (decoded as { userId: number }).userId;

    req.userId = userId;

    next();
  } catch (error) {
    return res.status(401).send("Invalid token");
  }
};

// Zod validation for incoming data
const taskSchema = z.object({
  title: z.string("Title must be a string"),
  completed: z.boolean("Completed must be true or false"),
});
// Zod validation for incoming data
const usersSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const postsSchema = z.object({
  title: z.string("Title must be a string"),
  body: z.string("Body must be a string"),
});

// Home route to prevent 'Cannot GET /'. Just display of it
app.get("/", (req, res) => {
  res.send("Welcome to the TaskFlow API! Access tasks at /tasks");
});

// Sign up user for log in later
app.post("/auth/signup", async (req, res) => {
  const existingUser = usersSchema.safeParse(req.body);

  if (!existingUser.success) {
    return res
      .status(400)
      .send(existingUser.error.issues.map((issue) => issue.message).join(", "));
  }
  const email = existingUser.data.email;
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });
  if (user !== null) {
    return res.status(409).send("Email is already registered");
  } else {
    const hash = await bcrypt.hash(existingUser.data.password, 10);
    const assignUser = await prisma.user.create({
      data: {
        email: existingUser.data.email,
        passwordHash: hash,
      },
    });
    const { passwordHash, ...safeUser } = assignUser;
    res.send(safeUser);
  }
});

// User Log in and gives a token that is temporarily
app.post("/auth/login", async (req, res) => {
  const existingUser = usersSchema.safeParse(req.body);

  if (!existingUser.success) {
    return res
      .status(400)
      .send(existingUser.error.issues.map((issue) => issue.message).join(", "));
  } else {
    const email = existingUser.data.email;
    const password = existingUser.data.password;
    const findUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (findUser === null) {
      return res.status(401).send("Invalid email or password");
    }
    const passwordCorrect = await bcrypt.compare(
      password,
      findUser.passwordHash,
    );
    if (!passwordCorrect) {
      return res.status(401).send("Invalid email or password");
    }
    if (jwtSecret == null) {
      return res.status(401).send("JWT secret is not configured");
    }

    // Separate hash and safeUser to remove avoid sending the password as token
    const { passwordHash, ...safeUser } = findUser;
    // I can use the String(findUser.id) but not recommended
    const accessToken = jwt.sign({ userId: findUser.id }, jwtSecret, {
      expiresIn: "1h",
    });
    // Send user + access token in one response to avoid "Cannot set headers after they are sent"
    res.json({
      message: "Login successful!",
      user: safeUser,
      token: accessToken,
    });
  }
});

// Get all of the task
app.get("/tasks", authMiddleware, async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: {
      userId: req.userId,
    },
  });
  res.send(tasks);
});

// Get a task by its ID
app.get("/tasks/:id", authMiddleware, async (req, res) => {
  const id = z.coerce.number().safeParse(req.params.id);

  if (!id.success) {
    return res.status(400).send(id.error.issues.map((issue) => issue.message));
  } else {
    const taskId = id.data;
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });
    if (task === null) {
      return res.status(404).send("Task not found");
    } else if (task.userId !== req.userId) {
      return res
        .status(403)
        .send("You do not have permission to get this task");
    } else {
      res.send(task);
    }
  }
});

// Create a new task and assign it to the authenticated user
app.post("/tasks", authMiddleware, async (req, res) => {
  const result = taskSchema.safeParse(req.body);

  if (!result.success) {
    return res
      .status(400)
      .send(result.error.issues.map((issue) => issue.message).join(", "));
  } else {
    const title = result.data.title;
    const completed = result.data.completed;

    const assignTask = await prisma.task.create({
      data: {
        title,
        completed,
        userId: req.userId,
      },
    });
    res.send(assignTask);
  }
});

// Update an existing task
app.put("/tasks/:id", authMiddleware, async (req, res) => {
  const result = taskSchema.safeParse(req.body);
  const id = z.coerce.number().safeParse(req.params.id);

  if (!id.success) {
    return res.status(400).send(id.error.issues.map((issue) => issue.message));
  } else if (!result.success) {
    return res
      .status(400)
      .send(result.error.issues.map((issue) => issue.message).join(", "));
  } else {
    const taskId = id.data;
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });
    if (task === null) {
      return res.status(404).send("Task not found");
    } else if (task.userId !== req.userId) {
      return res
        .status(403)
        .send("You do not have permission to update this task");
    } else {
      const title = result.data.title;
      const completed = result.data.completed;
      const update = await prisma.task.update({
        where: {
          id: taskId,
        },
        data: {
          title: title,
          completed: completed,
        },
      });
      res.send(update);
    }
  }
});

// Delete an existing task by its ID
app.delete("/tasks/:id", authMiddleware, async (req, res) => {
  const id = z.coerce.number().safeParse(req.params.id);

  if (!id.success) {
    return res.status(400).send(id.error.issues.map((issue) => issue.message));
  } else {
    const taskId = id.data;
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });
    if (task === null) {
      return res.status(404).send("Task not found");
    } else if (task.userId !== req.userId) {
      return res
        .status(403)
        .send("You do not have permission to delete this task");
    } else {
      const deleteTask = await prisma.task.delete({
        where: {
          id: taskId,
        },
      });
      res.send(deleteTask);
    }
  }
});

app.get("/posts", authMiddleware, async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const skip = (page - 1) * limit;

  const posts = await prisma.post.findMany({
    skip: skip,
    take: limit,
  });
  res.send(posts);
});

app.post("/posts", authMiddleware, async (req, res) => {
  const post = postsSchema.safeParse(req.body);

  if (!post.success) {
    return res
      .status(400)
      .send(post.error.issues.map((issue) => issue.message));
  } else {
    const title = post.data.title;
    const body = post.data.body;
    const posts = await prisma.post.create({
      data: {
        title,
        body,
        authorId: req.userId,
      },
    });
    res.send(posts);
  }
});

app.get("/posts/:id/comments", authMiddleware, async (req, res) => {});
app.post("/posts/:id/comments", authMiddleware, async (req, res) => {});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).send(err.message);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
