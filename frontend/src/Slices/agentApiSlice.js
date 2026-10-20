import { AGENT_URL } from "../constants";
import { apiSlice } from "./apiSlice";

// Public tour data and partner sign-up. Partner and admin management use utils/partnerApi.js.
export const agentApiSlice = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAllTours: builder.query({
            query: () => ({ url: `${AGENT_URL}/alltours` }),
            providesTags: ['Tour'],
            keepUnusedDataFor: 5,
        }),
        getTourPlaces: builder.query({
            query: (tourId) => ({ url: `${AGENT_URL}/tourplaces/${tourId}` }),
            providesTags: ['Place'],
            keepUnusedDataFor: 5,
        }),
        createAgent: builder.mutation({
            query: (formData) => ({
                url: `/agentSignUp`,
                method: 'POST',
                body: formData,
            }),
            invalidatesTags: ['Agent'],
        }),
    }),
});

export const {
    useGetAllToursQuery,
    useGetTourPlacesQuery,
    useCreateAgentMutation,
} = agentApiSlice;
