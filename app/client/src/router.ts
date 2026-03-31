import Navigo from 'navigo';
import { renderWorksheet } from './pages/worksheet';
import { renderVocabularyProgress } from './pages/vocabulary-progress';
import { renderSearch } from './pages/search';
import { renderAccount } from './pages/account';
import { renderAbout } from './pages/about';
import { renderHeader } from './components/header';
import { renderStudents } from './pages/students';
import { authService } from './auth';

const router = new Navigo('/');
const app = document.getElementById('app')!;

app.innerHTML = `
    <div id="header-container"></div>
    <div id="content-container"></div>
`;

const headerContainer = document.getElementById('header-container')!;
const contentContainer = document.getElementById('content-container')!;

const updateHeader = () => {
    renderHeader(headerContainer, router);
};

router.hooks({
    before: (done, match) => {
        updateHeader();
        // Redirect to account if not authenticated and not on public pages
        if (!authService.isAuthenticated() && match.url !== 'account' && match.url !== 'about') {
            router.navigate('/account');
            done(false);
        } else if (match.url === '' && authService.getUser()?.role === 'teacher' && !match.queryString?.includes('studentId')) {
             // Teachers don't have a default worksheet view, redirect to students unless viewing a specific student
             router.navigate('/students');
             done(false);
        } else {
            done();
        }
    },
    after: (match) => {
        const links = document.querySelectorAll<HTMLAnchorElement>('nav a');
        const urlStr = "/" + match.url;
        links.forEach(link => {
            const href = link.getAttribute('href');
            // Navigo matches base routes, but we might have query params we want to ignore for active state
            if (href === urlStr || (href === '/' && urlStr.startsWith('/?'))) {
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
    },
    '/students': () => {
        renderStudents(contentContainer);
    }
}).resolve();

export default router;
