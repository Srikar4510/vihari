import React, { useEffect, useRef, useState } from "react";
import "../CSS/CityAutocomplete.css";

// Cities that have bus routes. These are suggested first, before the Photon results.
const POPULAR_CITIES = [
  "Hyderabad", "Bangalore", "Chennai", "Mumbai", "Pune", "Delhi", "Agra", "Jaipur",
  "Goa", "Ahmedabad", "Vijayawada", "Visakhapatnam", "Tirupati", "Eluru", "Mysore", "Pondicherry",
];

// OpenStreetMap uses official names; bus routes use the common names.
const ALIASES = { bengaluru: "Bangalore", mysuru: "Mysore", puducherry: "Pondicherry", panaji: "Goa" };
const canonical = (name) => ALIASES[name.toLowerCase()] || name;

// Photon (https://photon.komoot.io) is a free, key-less OpenStreetMap geocoder built for search-as-you-type.
const PHOTON_URL = "https://photon.komoot.io/api/";
const INDIA_BBOX = "68.1,6.5,97.4,35.7";

async function searchPhoton(query, signal) {
  const params = new URLSearchParams({ q: query, limit: "8", lang: "en", bbox: INDIA_BBOX });
  ["place:city", "place:town"].forEach((tag) => params.append("osm_tag", tag));
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
  const data = await res.json();
  return data.features
    .filter((f) => f.properties.countrycode === "IN" && f.properties.name)
    .map((f) => ({ name: canonical(f.properties.name), state: f.properties.state || "" }));
}

const CityAutocomplete = ({ name, value, placeholder, onChange }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const query = value.trim();
    if (!open) return undefined;

    const local = POPULAR_CITIES.filter((c) => c.toLowerCase().startsWith(query.toLowerCase())).map((c) => ({
      name: c, state: "", popular: true,
    }));
    setSuggestions(local.slice(0, 6));
    setActive(-1);
    if (query.length < 2) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const remote = await searchPhoton(query, controller.signal);
        const seen = new Set(local.map((c) => c.name.toLowerCase()));
        const merged = [...local];
        remote.forEach((c) => {
          if (!seen.has(c.name.toLowerCase())) {
            seen.add(c.name.toLowerCase());
            merged.push(c);
          }
        });
        setSuggestions(merged.slice(0, 8));
      } catch (err) {
        if (err.name !== "AbortError") console.error("City search failed:", err);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, open]);

  useEffect(() => {
    const close = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (city) => {
    onChange({ target: { name, value: city.name } });
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      select(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="city-autocomplete" ref={wrapperRef}>
      <input
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <ul className="city-suggestions">
          {suggestions.map((city, i) => (
            <li
              key={`${city.name}-${city.state}-${i}`}
              className={i === active ? "active" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                select(city);
              }}
            >
              <i className="fa fa-map-marker-alt" />
              <span className="city-name">{city.name}</span>
              <span className="city-meta">{city.popular ? "Popular" : city.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CityAutocomplete;
