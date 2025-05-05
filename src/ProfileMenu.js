import React, { useEffect, useState } from "react";

const ProfileMenu = ({ socket }) => {
  const [currentPseudo, setCurrentPseudo] = useState("Player");
  const [newPseudo, setNewPseudo] = useState("");
  const [appearances, setAppearances] = useState([]);
  const [currentAppearanceIndex, setCurrentAppearanceIndex] = useState(0);

  useEffect(() => {
    // Fetch appearances from the server
    fetch("http://localhost:4000/assets/apparences") // Ensure the URL matches the server
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((files) => {
        setAppearances(files);
      })
      .catch((err) => {
        console.error("Error fetching appearances:", err);
      });
  }, []);

  const handlePseudoChange = () => {
    if (newPseudo.trim() && socket) {
      socket.emit("updatePseudo", { pseudo: newPseudo });
      setCurrentPseudo(newPseudo);
      setNewPseudo("");
    }
  };

  const handleAppearanceChange = (direction) => {
    if (appearances.length > 0) {
      let newIndex =
        (currentAppearanceIndex + direction + appearances.length) %
        appearances.length;
      setCurrentAppearanceIndex(newIndex);
      if (socket) {
        socket.emit("updateAppearance", { character: appearances[newIndex] });
      }
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>Profile Menu</h2>
      <div style={{ marginBottom: "20px" }}>
        <strong>Current Pseudo:</strong> {currentPseudo}
      </div>
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="New Pseudo"
          value={newPseudo}
          onChange={(e) => setNewPseudo(e.target.value)}
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            marginRight: "10px",
          }}
        />
        <button
          onClick={handlePseudoChange}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Change Pseudo
        </button>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <strong>Appearance:</strong>
        <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
          <button
            onClick={() => handleAppearanceChange(-1)}
            style={{
              padding: "10px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginRight: "10px",
            }}
          >
            {"<"}
          </button>
          {appearances.length > 0 ? (
            <img
              src={`/public/assets/apparences/${appearances[currentAppearanceIndex]}`}
              alt="Appearance"
              style={{ width: "100px", height: "100px", objectFit: "cover" }}
            />
          ) : (
            <span>Loading...</span>
          )}
          <button
            onClick={() => handleAppearanceChange(1)}
            style={{
              padding: "10px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginLeft: "10px",
            }}
          >
            {">"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileMenu;
