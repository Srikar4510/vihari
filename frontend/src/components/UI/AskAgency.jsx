import React from "react";
import "../CSS/AskAgency.css";
import busAgency from "../../Assets/bus_agency.jpg";
import tripImage from "../../Assets/trip_img.svg";
import { useNavigate } from "react-router-dom";
import Reveal from "./Reveal";
const AskAgency = () => {
  const navigate = useNavigate();

  const handleAgency = (e) => {
    navigate("/agentSignUp");
  };

  return (
    <section className="AskAgency">
      <div className="container">
        <Reveal effect="zoom" className="agency-card">
          <img className="busImage" src={busAgency} alt="Bus agency" />
          <div className="agency-text">
            <span className="agency-eyebrow">For bus operators and travel agents</span>
            <h2>Add Your Agency</h2>
            <p>
              Interested in expanding your agency's reach? Partner with us and showcase your buses
              and trip services to thousands of travellers.
            </p>
            <button className="AddAgency" onClick={handleAgency}>
              Become a partner <i className="fa fa-arrow-right" />
            </button>
          </div>
          <img className="busImage2" src={tripImage} alt="Trip illustration" />
        </Reveal>
      </div>
    </section>
  );
};

export default AskAgency;
