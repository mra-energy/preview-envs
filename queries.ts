import { gql } from "graphql-request";

// build queries with completion at https://api.fly.io/graphql

export const listMachines = gql`
query Machines {
  machines(appId: "mra") {
    nodes {
      host {
        id
      }
      id
      name
      state
    }
  }
}
`;
