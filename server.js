const dotenv = require("dotenv");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const expressasync = require("express-async-handler");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { urlencoded } = require("express");
const flash = require("connect-flash");
//user model
const userschema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    books: [
      {
        type: Object,
      },
    ],
  },
  {
    timestamps: true,
  }
);
const User = mongoose.model("User", userschema);
//book schema
const bookschema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    isbn: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Romantic", "Science", "Programming", "Novel"],
    },
    desc: {
      type: String,
      required: true,
    },
    createdby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
const Book = mongoose.model("Book", bookschema);

dotenv.config();
//middlware
app.use(express.json());
app.use(urlencoded({ extended: true }));

//server static
app.use(express.static(__dirname + "/public"));
//configure session
app.use(
  session({
    secret: process.env.sessionkey,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
      mongoUrl: process.env.mongourl,
      ttl: 1 * 60 * 60, //1hour expiration
    }),
  })
);
app.use(flash());
app.use((req, res, next) => {
  if (req.session.authUser) {
    res.locals.authUser = req.session.authUser;
  } else {
    res.locals.authUser = null;
  }
  next();
});
app.get("/", async (req, res) => {
  try {
    const books = await Book.find();
    res.render("../views/index", {
      books,
      error: req.flash("error"),
    });
  } catch (error) {
    req.flash("error", error.message);
    res.redirect("/");
  }
});
app.set("view engine", "ejs");
// app.use("/api", userRoute);
// app.use("/api", bookRoute);
// mongoose
//   .connect(
//     ""
//   )
//   .then(() => {
//     console.log("DB connected");
//   })
//   .catch((error) => {
//     console.log("Error is ${error.message}");
//   });
const dbconnect = async () => {
  try {
    await mongoose.connect(process.env.mongourl);
    console.log("DB connected");
  } catch (error) {
    console.log(`DB failed ${error.message}`);
  }
};
dbconnect();

//------
//user
//register
app.get("/api/users/register", (req, res) => {
  res.render("../views/register", {
    error: req.flash("error"),
  });
});
app.post(
  "/api/users/register",
  expressasync(async (req, res) => {
    console.log(req.body);
    //check if already registered
    const founduser = await User.findOne({ email: req.body.email });
    if (founduser) {
      req.flash("error", "User existed");
      return res.redirect("/api/users/register");
    }
    //console.log(req.body);
    //hash userpassword
    const salt = await bcrypt.genSalt(10);
    const hashedpassword = await bcrypt.hash(req.body.password, salt);

    try {
      const user = await User.create({
        fullname: req.body.fullname,
        email: req.body.email,
        password: hashedpassword,
      });
      res.redirect("/api/users/login");
    } catch (error) {
      res.json(error);
    }
  })
);

app.get("/api/users/login", (req, res) => {
  res.render("../views/login", {
    error: req.flash("error"),
  });
});

//login
app.post(
  "/api/users/login",
  expressasync(async (req, res) => {
    try {
      //check if exist
      const userfound = await User.findOne({ email: req.body.email });
      if (!userfound) {
        req.flash("error", "Invalid user or password");
        return res.redirect("/api/users/login");
      }
      const ismatched = await bcrypt.compare(
        req.body.password,
        userfound.password
      );
      if (!ismatched) {
        req.flash("error", "Invalid user or password");
        return res.redirect("/api/users/login");
      }
      //put the user into session
      req.session.authUser = userfound;
      res.redirect(`/api/users/profile/${userfound._id}`);
    } catch (error) {
      res.json(error);
    }
  })
);

//logout
app.get("/api/users/logout", (req, res) => {
  req.session.destroy(() => {
    res.render("../views/login");
  });
});

//fecth all users
app.get("/api/users", async (req, res) => {
  console.log(req.session);
  try {
    const allusers = await User.find();
    res.json({
      allusers,
    });
  } catch (error) {
    res.json(error);
  }
});

//fecth a user
app.get("/api/users/:id", async (req, res) => {
  //console.log(req.params);
  try {
    const singleuser = await User.findById(req.params.id);
    res.json({
      singleuser,
    });
  } catch (error) {
    res.json(error);
  }
});

//user profile
app.get("/api/users/profile/:id", async (req, res) => {
  //req.session.user = "fang";
  //check if logined
  if (!req.session.authUser) {
    return res.json("Access denied");
  }
  //console.log(req.session);
  try {
    const singleuser = await User.findById(req.params.id);
    res.render("profile", { singleuser });
  } catch (error) {
    res.json(error);
  }
});

//update user
app.put("/api/users/update/:id", async (req, res) => {
  try {
    res.json({
      msg: "update a user endpoint",
    });
  } catch (error) {
    res.json(error);
  }
});

//books
//books
//create a book
app.get("/api/books", (req, res) => {
  res.render("../views/books/addBook", {
    error: req.flash("error"),
  });
});
app.post(
  "/api/books",
  expressasync(async (req, res) => {
    //check if exist
    if (!req.session.authUser) {
      req.flash("error", "Please log in first");
      return res.redirect("/api/users/login");
    }

    const bookfound = await Book.findOne({ title: req.body.title });
    if (bookfound) {
      req.flash("error", `This book ${req.body.title} already existed`);
      return res.redirect("/api/books");
    }
    //check if logged in

    try {
      const book = await Book.create({
        title: req.body.title,
        author: req.body.author,
        isbn: req.body.isbn,
        desc: req.body.desc,
        createdby: req.session.authUser._id,
        category: req.body.category,
      });
      const theuser = await User.findById(req.session.authUser._id);
      //push theuser into the field of logged in user
      theuser.books.push(book);
      await theuser.save();
      res.redirect(`/api/users/profile/${theuser._id}`);
    } catch (error) {
      req.flash("error", error.message);
      return res.redirect("/api/books");
    }
  })
);

//fetch all books
app.get(
  "/api/books",
  expressasync(async (req, res) => {
    try {
      const booksall = await Book.find().populate("createdby");
      res.json(booksall);
    } catch (error) {
      res.json(error);
    }
  })
);

//fecth a book
// app.get(
//   "/api/books/:id",
//   expressasync(async (req, res) => {
//     try {
//       const abook = await Book.findById(req.params.id);
//       res.json(abook);
//     } catch (error) {
//       res.json(error);
//     }
//   })
// );

//delete
app.get(
  "/api/books/delete/:id",
  expressasync(async (req, res) => {
    try {
      await Book.findByIdAndDelete(req.params.id);
      res.redirect("/");
      res.json("deleted a book successfully");
    } catch (error) {
      res.send("Book delete failed");
    }
  })
);

//update a book
app.get(
  "/api/books/:id",
  expressasync(async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);
      res.render("../views/books/editBook", {
        book,
        error: req.flash("error"),
      });
    } catch (error) {
      req.flash("error", error.message);
      res.redirect("/");
    }
  })
);
app.post(
  "/api/books/:id",
  expressasync(async (req, res) => {
    try {
      const bookupdated = await Book.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );
      res.redirect("/");
    } catch (error) {
      req.flash("error", error.message);
      redirect("/");
    }
  })
);
//not found
const notfound = (req, res, next) => {
  const error = new Error("Not found endpoint");
  res.status(404);
  next(error);
};

//error handler middleware
const errorhandler = (err, req, res, next) => {
  res.json({
    message: err.message,
    stack: err.stack,
  });
};

app.use(notfound);
app.use(errorhandler);
const Port = process.env.Port || 7000;
app.listen(Port, () => {
  console.log("Server is up");
});
