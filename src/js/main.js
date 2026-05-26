'use strict';

const KchipsLib = window.KchipsLib || {};
const { $, Swiper, gsap, flatpickr } = KchipsLib;

const commonFunction = (() => {
	let lastScroll = 0;
	let prevDir = null; // 1: down, -1: up

	/*! S helper */
	const delay = (n) => { // delay
		new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, n);
		});
	}
	const getScrollDelta = () => {
		const currentScroll = window.scrollY || document.documentElement.scrollTop;
		const delta = currentScroll - lastScroll;
		lastScroll = currentScroll;

		return delta;
	}
	/*! E helper */

	/*! S 공통 스크립트 */
	const setGnb = () => { // set gnb
		const gnb = document.querySelector('.gnb');
		const delta = getScrollDelta();
		if (delta === 0) return;
		if (gnb.closest('#guide')) return;

		const dir = delta > 0 ? 1 : -1;

		// 초기 1회 또는 방향 전환 시에만 실행
		if (prevDir === null || dir !== prevDir) {
			if (dir === 1) {
				document.body.classList.remove('up');
				document.body.classList.add('down');
				gsap.set(gnb, { y: 0 });
			} else {
				document.body.classList.remove('down');
				document.body.classList.add('up');
				gsap.fromTo(gnb, { y: '-100%' }, { y: '0%', duration: 0.3 });
			}
		}

		if(lastScroll == 0) document.body.classList.remove('up', 'down');

		prevDir = dir;

		// 상단 kv 존재시 gnb 색상 변경
		const topkv = document.querySelector('.top-kv');
		if(!topkv) return;

		if(lastScroll < topkv.offsetHeight) {
			gnb.classList.remove('white');
		} else {
			gnb.classList.add('white');
		}
	};
	const setFlatPickr = () => { // set flatPickr
		const dateField = document.querySelectorAll('.date-field');

		dateField.forEach((wrap) => {
			const input = wrap.querySelector('.js-datepicker');
			if (!input || !flatpickr) return;

			const fp = flatpickr(input, {
				dateFormat: 'Y-m-d',
				disableMobile: true, // 모바일도 flatpickr UI 강제
				allowInput: false,
				clickOpens:  false // input 클릭 시 달력 열기
			});

			wrap.addEventListener('click', () => fp.open());
		});
	}
	const setSwiper = (target, addOption = {}) => { // set swiper slide
		try {
			if (!Swiper) return;

			const control = document.querySelector(`.slide-control[data-slide-match="${target}"]`);
			const prevEl = control?.querySelector('.prev') || null;
			const nextEl = control?.querySelector('.next') || null;

			new Swiper(`.${target}`, {
				observer: true,
				observeParents: true,
				navigation: {
					prevEl,
					nextEl
				},
				...addOption
			});
		}catch {
			console.error(new Error('Failed to initialize partners swiper'));
		}
	}
	const updateDimByCount = (swiper, keepCount = 2, className = 'is-dimmed') => { // swiper slide dimmed
		const slides = [...(swiper?.slides || [])];
		if (!slides.length || keepCount < 1) return;

		slides.forEach((el) => el.classList.add(className));

		for (let i = 0; i < keepCount; i++) {
			const idx = (swiper.activeIndex + i) % slides.length;
			slides[idx]?.classList.remove(className);
		}
	};
	const setTabControl = () => { // tab control
		const tabNav = document.querySelectorAll('.tab-nav');
		
		tabNav.forEach((nav) => {
			const tabContents = nav.nextElementSibling;

			if(!tabContents) return;

			const tabInner = tabContents.querySelectorAll('.tab-inner');
			const tabs = nav.querySelectorAll('a');
			
			tabs.forEach((tab) => {
				if(tab.classList.contains('on')){
					tab.setAttribute('aria-selected', 'true');
					const tabPanel = Array.from(tabInner).filter((panel) => panel.getAttribute('aria-labelledby') === tab.id);
					tabPanel[0]?.removeAttribute('hidden');
				};

				tab.addEventListener('click', () => {
					const tabPanel = Array.from(tabInner).filter((panel) => panel.getAttribute('aria-labelledby') === tab.id);

					tabs.forEach((t) => {
						t.setAttribute('aria-selected', 'false')
						t.classList.remove('on');
					});
					
					tab.setAttribute('aria-selected', 'true');
					tab.classList.add('on');

					tabInner.forEach((panel) => panel.setAttribute('hidden', 'true'));
					tabPanel[0]?.removeAttribute('hidden');
				});
			});
		});
	}
	const copyTextToClipboard = async (text) => { // copy text to clipboard
		if (!text) return false;

		if (navigator.clipboard && window.isSecureContext) {
			try {
				await navigator.clipboard.writeText(text);
				return true;
			} catch (error) {
				// fallback 진행
			}
		}

		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', '');
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();

		let copied = false;
		try {
			copied = document.execCommand('copy');
		} catch (error) {
			copied = false;
		}

		document.body.removeChild(textarea);
		return copied;
	};
	const fileUpload = () => {
		const fileBoxes = document.querySelectorAll('.file-box');

		if (!fileBoxes.length) return;

		fileBoxes.forEach((box) => {
			const input = box.querySelector('input[type="file"]');
			const fileName = box.querySelector('.file-name');

			if (!input || !fileName) return;

			const defaultText = fileName.textContent?.trim() || 'Click to upload files';
			const setAttachedState = (hasFile) => {
				box.classList.toggle('is-attached', hasFile);
			};

			setAttachedState(!!(input.files && input.files.length));

			input.addEventListener('change', () => {
				const files = Array.from(input.files || []);

				if (!files.length) {
					setAttachedState(false);
					fileName.textContent = defaultText;
					return;
				}

				setAttachedState(true);
				fileName.textContent = files.map((file) => file.name).join(', ');
			});
		});
	}
	/*! E 공통 스크립트 */

	const init = () => { // 초기화 함수
		setGnb();
		setFlatPickr();
		setTabControl();
		fileUpload();
	}

	return {
		init,
		setGnb,
		setSwiper,
		updateDimByCount,
		copyTextToClipboard,
	}
})();

window.commonFunction = commonFunction;

document.addEventListener('DOMContentLoaded', () => {
	if ($) {
		$('body').addClass('is-ready');
	}

	if (document.body.classList.contains('is-ready')) {
		commonFunction.init();
	}
});

let scrollTimer = null;

window.addEventListener('scroll', () => {
	if(scrollTimer != null) return

	scrollTimer = setTimeout(() => {
		commonFunction.setGnb();
		scrollTimer = null;
	}, 100);
});