import '@testing-library/jest-dom';

// jsdom doesn't implement scrolling; the chat calls it to follow new messages.
window.scrollTo = () => {};
