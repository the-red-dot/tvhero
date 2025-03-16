// src/components/Modal.jsx

import React from 'react';

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null; // if not open, render nothing

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="close-button" onClick={onClose}>
          &times;
        </span>
        {children}
      </div>
    </div>
  );
}

export default Modal;
