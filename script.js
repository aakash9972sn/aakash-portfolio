'use strict';
const projects = {
  guess: {
    title: 'Perfect Guess', category: '01 / GAME DEVELOPMENT',
    description: 'A browser game that challenges players to find a number between 1 and 1000. Each guess brings them closer through higher-or-lower feedback.',
    features: ['Attempt counter and guess history', 'Best score stored in the browser', 'New-game reset and number input'],
    url: 'https://github.com/aakash9972sn/perfect_guess'
  },
  quiz: {
    title: 'Biology Test', category: '02 / LEARNING TOOL',
    description: 'A biology practice quiz built around a timed test flow. Players can navigate questions, save progress locally, and review answers after submitting.',
    features: ['60-minute test timer', 'Saved progress with resume support', 'Answer review with explanations and a score summary'],
    url: 'https://github.com/aakash9972sn/newTest'
  },
  shop: {
    title: 'Blunder Pro Max', category: '03 / FRONTEND EXPLORATION',
    description: 'An experimental shopping frontend with a responsive navigation bar, a promotional hero, and product cards. It is a UI prototype, with basic cart interactions rather than a complete checkout service.',
    features: ['Responsive product grid', 'Product prices and promotional labels', 'Basic add-to-cart JavaScript interactions'],
    url: 'https://github.com/aakash9972sn/my-website'
  }
};
const dialog = document.querySelector('#project-dialog');
let opener = null;
document.querySelectorAll('[data-project]').forEach(button => {
  button.addEventListener('click', () => {
    const project = projects[button.dataset.project];
    if (!project) return;
    opener = button;
    document.querySelector('#dialog-title').textContent = project.title;
    document.querySelector('#dialog-category').textContent = project.category;
    document.querySelector('#dialog-description').textContent = project.description;
    document.querySelector('#dialog-link').href = project.url;
    const list = document.querySelector('#dialog-features');
    list.replaceChildren(...project.features.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    dialog.showModal();
    document.body.classList.add('dialog-open');
  });
});
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  opener?.focus();
});
document.querySelector('#year').textContent = new Date().getFullYear();
