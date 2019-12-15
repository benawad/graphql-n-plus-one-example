const { ApolloServer, gql } = require("apollo-server");
const knex = require("knex")({
  client: "sqlite3",
  connection: {
    filename: "./mydb.sqlite"
  }
});
const faker = require("faker");
const DataLoader = require("dataloader");

const resolvers = {
  Book: {
    author: async (parent, _, ctx) => {
      return ctx.authorLoader.load(parent.authorId);
    }
  },
  Query: {
    books: async () => {
      const books = await knex("books")
        .select()
        .limit(5);
      return books;
    }
  }
};

const typeDefs = gql`
  type Author {
    id: ID!
    name: String!
  }

  type Book {
    id: ID!
    title: String
    author: Author!
  }

  type Query {
    books: [Book]
  }
`;

knex("users")
  .select()
  .limit(1)
  .catch(async err => {
    if (err.message.includes("no such table")) {
      await knex.schema.createTable("users", table => {
        table.increments("id");
        table.string("name");
      });
      await knex.schema.createTable("books", table => {
        table.increments("id");
        table.string("title");
        table.integer("authorId");
        table.foreign("authorId").references("users.id");
      });
      for (let i = 0; i < 100; i++) {
        const ids = await knex("users").insert({
          name: faker.name.findName()
        });
        await knex("books").insert({
          title: faker.company.companyName(),
          authorId: ids[0]
        });
      }
    } else {
      throw err;
    }
  })
  .then(() => {
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: () => {
        return {
          authorLoader: new DataLoader(async keys => {
            const authors = await knex("users")
              .select()
              .whereIn("id", keys);

            const authorMap = {};
            authors.forEach(author => {
              authorMap[author.id] = author;
            });

            return keys.map(key => authorMap[key]);
          })
        };
      }
    });

    server.listen().then(({ url }) => {
      console.log(`🚀  Server ready at ${url}`);
    });
  });
