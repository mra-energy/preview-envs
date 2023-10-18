import { GraphQLClient } from "graphql-request"
import { input } from "../input"
import { getSdk } from "./sdk"

const gqlClient = new GraphQLClient('https://api.fly.io/graphql', {
  headers: { authorization: input.flyToken }
})
export const fly = getSdk(gqlClient)