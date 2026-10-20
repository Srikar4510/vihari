import React from "react";
import Navbar from "../components/UI/Navbar";
import Footer from "../components/UI/Footer";
import { Link, useParams } from "react-router-dom";
import "../components/CSS/ToursPage.css";
import { useGetTourPlacesQuery } from "../Slices/agentApiSlice";
import Loader from "../components/Loader/Loader";
import Reveal from "../components/UI/Reveal";
import { imageUrl } from "../utils/imageUrl";

const TourPlaces = () => {
    const { id } = useParams();
    const { data: placeData, isLoading } = useGetTourPlacesQuery(id);

    if (isLoading) {
        return <Loader />;
    }

    const places = placeData?.places || [];
    const tour = placeData?.tour;

    return (
        <>
            <Navbar />
            <div className="tours-page">
                <section
                    className="tour-detail-hero"
                    style={{ backgroundImage: `url('${imageUrl(tour?.DispImageurl || places[0]?.Imageurl)}')` }}
                >
                    <div className="tours-hero-overlay" />
                    <div className="container">
                        <Link to="/tours" className="back-link"><i className="fa fa-arrow-left" /> All tours</Link>
                        <h1 className="hero-step">{tour?.tname || 'Tour places'}</h1>
                        {tour && (
                            <div className="tour-detail-meta hero-step" style={{ animationDelay: '0.15s' }}>
                                {tour.duration && <span><i className="far fa-clock" /> {tour.duration}</span>}
                                <span><i className="fa fa-map-marker-alt" /> {places.length} places</span>
                                {tour.rating && <span><i className="fa fa-star" /> {tour.rating} ({tour.reviews} reviews)</span>}
                                <span><i className="fa fa-tag" /> ₹{tour.tprice.toLocaleString('en-IN')} per person</span>
                            </div>
                        )}
                    </div>
                </section>

                <div className="container">
                    {places.length === 0 ? (
                        <div className="tours-empty">
                            <i className="fa fa-map-signs" />
                            <p>No places have been added to this tour yet.</p>
                        </div>
                    ) : (
                        <div className="itinerary">
                            {places.map((place, i) => (
                                <div key={place._id} className="itinerary-item" id={`place-item-${place._id}`}>
                                    <div className="itinerary-step">{i + 1}</div>
                                    <Reveal effect={i % 2 ? 'right' : 'left'} className="itinerary-photo">
                                        <img src={imageUrl(place.Imageurl)} alt={place.name} loading="lazy" />
                                    </Reveal>
                                    <Reveal effect={i % 2 ? 'left' : 'right'} delay={150} className="itinerary-text">
                                        <span>Stop {i + 1}</span>
                                        <h2>{place.name}</h2>
                                        <p>{place.description}</p>
                                    </Reveal>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </>
    );
};

export default TourPlaces;
