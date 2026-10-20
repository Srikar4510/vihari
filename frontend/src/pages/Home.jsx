import React from "react";
import Navbar from "../components/UI/Navbar";
import Footer from "../components/UI/Footer";
import TravelPage from "../components/UI/TravelPage";
import Gallery from "../components/UI/Gallery";
import PackagesSection from "../components/UI/PackagesSection";
import Services from "../components/UI/Services";
import Reviews from "../components/UI/Reviews";
import AskAgency from "../components/UI/AskAgency";
import JourneyStrip from "../components/UI/JourneyStrip";
const Home = () => {
  return (
    <>
      <Navbar />
      <TravelPage />
      <JourneyStrip />
      <Gallery />
      <AskAgency />
      <PackagesSection />
      <Services />
      <Reviews />
      <Footer />

    </>
  );
};

export default Home;