import React from 'react';

function Header({ currentLibrary, onBurgerClick, onLoginClick, user, onLogout }) {
  return (
    <header>
      <div className="header-left">
        <button
          className="menu-button"
          aria-label="Toggle Menu"
          onClick={onBurgerClick}
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="#ffcc00"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
        <div id="auth-buttons">
          {user ? (
            <button id="logout-button" onClick={onLogout}>
              התנתקות
            </button>
          ) : (
            <button id="login-button" onClick={onLoginClick}>
              התחברות
            </button>
          )}
        </div>
      </div>
      <h1 id="library-title">{currentLibrary}</h1>
      <button id="view-toggle-button" aria-label="Change View">
        <svg viewBox="0 0 24 24">
          <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
        </svg>
      </button>
    </header>
  );
}

export default Header;
