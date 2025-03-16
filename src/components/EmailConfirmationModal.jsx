import React from 'react';
import Modal from './Modal';

function EmailConfirmationModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <div className="modal-header">
        <h2>אימות דואר אלקטרוני</h2>
      </div>
      <div className="modal-body">
        <p>אנא אמת את כתובת האימייל שלך כדי לגשת לכל הפונקציות באתר.</p>
        <button id="resend-verification-button" onClick={() => { /* Resend logic */ }}>
          שלח שוב אימייל לאימות
        </button>
      </div>
    </Modal>
  );
}

export default EmailConfirmationModal;
