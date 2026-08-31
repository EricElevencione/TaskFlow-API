import express from "express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db.js";
import * as z from "zod";
import bcrypt from "bcrypt";

const app = express();
const PORT = 3000;

app.use(express.json());

const taskSchema = z.object({
  title: z.string("Title must be a string"),
  completed: z.boolean("Completed must be true or false"),
});

const usersSchema = z.object({
  email: z.string("Email must be existing"),
  password: z.string("Password must be string"),
});

// Home route to prevent 'Cannot GET /'
app.get("/", (req, res) => {
  res.send("Welcome to the TaskFlow API! Access tasks at /tasks");
});

// GET all tasks
app.get("/tasks", async (req, res) => {
  const tasks = await prisma.task.findMany();
  res.send(tasks);
});

// POST for Users authentication
app.post("/auth/signup", async (req, res) => {
  const existingUser = usersSchema.safeParse(req.body);

  if (!existingUser.success) {
    return res
      .status(400)
      .send(existingUser.error.issues.map((issue) => issue.message).join(", "));
  } else {
    const { passwordHash, ...assignUser } = usersSchema;

    const assignUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });
    res.send(assignUser);
  }
});

// POST a new task dynamically
app.post("/tasks", async (req, res) => {
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
      },
    });
    res.send(assignTask);
  }
});

// Getting a specific task
app.get("/tasks/:id", async (req, res) => {
  // const id = Number(req.params.id);
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
    } else {
      res.send(task);
    }
  }
});

// const taskId = id.data;
//     const taskIdExist =
//       (await prisma.task.count({
//         where: {
//           id: taskId,
//         },
//       })) > 0;
//     if (!taskIdExist) {
//       return res.status(500).send("the ID don't exist in the database");
//     } else {
//       const task = await prisma.task.findUnique({
//         where: {
//           id: taskId,
//         },
//       });
//       res.send(task);
//     }

app.put("/tasks/:id", async (req, res) => {
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

app.delete("/tasks/:id", async (req, res) => {
  // const id = Number(req.params.id);
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
    } else {
      const deleteTask = await prisma.task.delete({
        where: {
          id: taskId,
        },
      });
      res.send(deleteTask);
    }
  }

  // const task = await prisma.task.findUnique({
  //   where: {
  //     id,
  //   },
  // });

  // if (!task) {
  //   return res.status(404).send("Task not found");
  // } else {
  //   const deleteTask = await prisma.task.delete({
  //     where: {
  //       id,
  //     },
  //   });
  //   res.send(deleteTask);
  // }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).send(err.message);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
