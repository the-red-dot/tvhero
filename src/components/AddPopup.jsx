import React from 'react';
import Modal from './Modal';

function AddPopup({ libraries, currentLibrary }) {
  const [isOpen, setIsOpen] = React.useState(false);

  // In a full implementation you’d add media to another library here.
  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <h3>הוסף לספרייה</h3>
      <ul id="add-library-list">
        {Object.keys(libraries).map(
          (libName) =>
            libName !== currentLibrary && (
              <li key={libName} onClick={() => setIsOpen(false)}>
                {libName}
              </li>
            )
        )}
      </ul>
      <button id="add-cancel-button" onClick={() => setIsOpen(false)}>
        ביטול
      </button>
    </Modal>
  );
}

export default AddPopup;
