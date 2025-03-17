import React from 'react';
import Modal from './Modal';
import '../styles/authmodal.css'; // Reuse the auth modal styles

function EmailConfirmationModal({ isOpen, onClose, onResend }) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="auth-modal email-confirmation-modal">
      <div className="modal-header">
        <h2>אימות דואר אלקטרוני</h2>
      </div>
      <div className="modal-body">
        <p>אנא אמת את כתובת האימייל שלך כדי לגשת לכל הפונקציות באתר.</p>
        <button
          className="auth-submit"
          id="resend-verification-button"
          onClick={onResend}
        >
          שלח שוב אימייל לאימות
        </button>
      </div>
    </Modal>
  );
}

export default EmailConfirmationModal;
