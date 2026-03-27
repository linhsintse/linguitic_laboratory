import Navigo from 'navigo';
import { renderWorksheet } from './pages/worksheet';

import { renderVocabularyProgress } from './pages/vocabulary-progress';
import { renderSearch } from './pages/search';
import { renderAccount } from './pages/account';
import { renderAbout } from './pages/about';
import { renderHeader } from './components/header';

const router = new Navigo('/');
const app = document.getElementById('app')!;

app.innerHTML = `
    <div id="header-container"></div>
    <div id="content-container"></div>
`;

const headerContainer = document.getElementById('header-container')!;
const contentContainer = document.getElementById('content-container')!;

renderHeader(headerContainer, router);

router.hooks({
    after: (match) => {
        const links = document.querySelectorAll<HTMLAnchorElement>('nav a');
        links.forEach(link => {
            if (link.getAttribute('href') === "/" + match.url) {
                link.classList.add('text-black', 'border-b-2', 'border-black', 'pb-2');
                link.classList.remove('text-text-muted', 'border-transparent');
            } else {
                link.classList.add('text-text-muted', 'border-b-2', 'border-transparent', 'pb-2');
                link.classList.remove('text-black', 'border-black');
            }
        });
    }
});

router.on({
    '/': () => {
        renderWorksheet(contentContainer);
    },
    
    '/vocabulary-progress': () => {
        renderVocabularyProgress(contentContainer);
    },
    '/search': () => {
        renderSearch(contentContainer);
    },
    '/account': () => {
        renderAccount(contentContainer);
    },
    '/about': () => {
        renderAbout(contentContainer);
    }
}).resolve();

export default router;
