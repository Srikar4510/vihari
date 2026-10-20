import { createApi,fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { BASE_URL } from "../constants";

const baseQuery=fetchBaseQuery({baseUrl:BASE_URL});

export const apiSlice=createApi({
    baseQuery,
    tagTypes:['Admin','Bus','Place','Ticket','Tour','User','Agent'],
    endpoints:(builder)=>({})

});