import React, { useState } from 'react';
import Modal from './Modal';
import '../styles/AddPopup.css';

function AddPopup({ isOpen, onClose, libraries, currentLibrary, onAdd }) {
  // Available libraries are those different from the current one.
  const availableLibraries = Object.keys(libraries).filter(lib => lib !== currentLibrary);
  // State for selected libraries (as an array)
  const [selectedLibraries, setSelectedLibraries] = useState([]);

  const handleCheckboxChange = (e) => {
    const lib = e.target.value;
    if (e.target.checked) {
      setSelectedLibraries(prev => [...prev, lib]);
    } else {
      setSelectedLibraries(prev => prev.filter(item => item !== lib));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedLibraries.length === 0) {
      alert('אנא בחר לפחות ספרייה אחת.');
      return;
    }
    onAdd(selectedLibraries);
    setSelectedLibraries([]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setSelectedLibraries([]);
      }}
    >
      <div className="add-popup-container">
        <h3 className="add-popup-title">הוסף לספרייה</h3>
        <form onSubmit={handleSubmit} className="add-popup-form">
          <div className="checkbox-group">
            {availableLibraries.length > 0 ? (
              availableLibraries.map(lib => (
                <label key={lib} className="checkbox-label">
                  <input
                    type="checkbox"
                    value={lib}
                    checked={selectedLibraries.includes(lib)}
                    onChange={handleCheckboxChange}
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom"></span>
                  {lib}
                </label>
              ))
            ) : (
              <p className="no-libraries">אין ספריות זמינות להוספה</p>
            )}
          </div>
          <div className="add-popup-buttons">
            <button type="submit" className="submit-button">
              הוסף
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                onClose();
                setSelectedLibraries([]);
              }}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default AddPopup;
