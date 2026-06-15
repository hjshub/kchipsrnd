'use strict';

const KchipsLib = window.KchipsLib || {};
const { $, Swiper, gsap, flatpickr } = KchipsLib;

const commonFunction = (() => {
	let lastScroll = 0;
	let prevDir = null; // 1: down, -1: up
	let modalControl = null;
	let pendingModalTargets = [];
	let filterControl = null;

	const delay = (n) => { // 딜레이 함수 (밀리초 단위)
		new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, n);
		});
	}
	const getScrollDelta = () => { // 스크롤 델타 계산
		const currentScroll = window.scrollY || document.documentElement.scrollTop;
		const delta = currentScroll - lastScroll;
		lastScroll = currentScroll;

		return delta;
	}
	const setGnb = () => { // gnb 설정
		const gnbList = [...document.querySelectorAll('.gnb')];
		const gnb = gnbList[gnbList.length - 1];
		if(!gnb) return;
		const list = gnb.querySelectorAll('.menu > li');
		const delta = getScrollDelta();

		list.forEach((item) => {
			item.addEventListener('mouseenter', () => { // 마우스 오버 시
				if(!item.querySelector('.depth2')) return;
				item.querySelector('.depth2').style.opacity = '1';
				item.querySelector('.depth2').style.visibility = 'visible';
				item.querySelector('.depth2').style.pointerEvents = 'auto';
			});
			item.addEventListener('focusin', () => { // 포커스 시
				if(!item.querySelector('.depth2')) return;
				item.querySelector('.depth2').style.opacity = '1';
				item.querySelector('.depth2').style.visibility = 'visible';
				item.querySelector('.depth2').style.pointerEvents = 'auto';
			});
			item.addEventListener('mouseleave', () => { // 마우스 리브 시 실행할 코드
				if(!item.querySelector('.depth2')) return;
				item.querySelector('.depth2').style.opacity = '0';
				item.querySelector('.depth2').style.visibility = 'hidden';
				item.querySelector('.depth2').style.pointerEvents = 'none';
			});
			item.addEventListener('focusout', (event) => { // 포커스 아웃 시
				if(!item.querySelector('.depth2')) return;
				if(event.relatedTarget && event.relatedTarget.closest('.depth2')) return;
				item.querySelector('.depth2').style.opacity = '0';
				item.querySelector('.depth2').style.visibility = 'hidden';
				item.querySelector('.depth2').style.pointerEvents = 'none';
			});
		});

		if (delta === 0 || gnb.closest('#guide')) return;

		const dir = delta > 0 ? 1 : -1;

		// 초기 1회 또는 방향 전환 시에만 실행
		if (prevDir === null || dir !== prevDir) {
			if (dir === 1) {
				document.documentElement.classList.remove('up');
				document.documentElement.classList.add('down');
				gsap.set(gnb, { y: 0 });
			} else {
				document.documentElement.classList.remove('down');
				document.documentElement.classList.add('up');
				gsap.fromTo(gnb, { y: '-100%' }, { y: '0%', duration: 0.3 });
			}
		}

		if(lastScroll == 0) document.documentElement.classList.remove('up', 'down');

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
	const allMenu = () => {
		// 모바일 전체메뉴
		const btnAllMenu = document.querySelector('.btn-all-menu');
		const allMenu = document.querySelector('.all-menu');
		const anchor = allMenu.querySelectorAll('a:not(.alone, .m-depth2 a)');

		if(!btnAllMenu || !allMenu || allMenu.closest('#guide')) return;

		btnAllMenu.addEventListener('click', () => {
			document.documentElement.classList.toggle('m-open');
		});

		anchor.forEach((el) => {
			el.addEventListener('click', () => {
				const listOn = el.closest('li').classList.toggle('on');
				anchor.forEach((otherEl) => {
					if (otherEl !== el) {
						otherEl.closest('li').classList.remove('on');
					}
				});

			});
		});
	}
	const setFlatPickr = () => { // flatPickr 설정
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
	const setSwiper = (target, addOption = {}) => { // swiper 설정
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
	const updateDimByCount = (swiper, keepCount = 2, className = 'is-dimmed') => { // swiper dimmed 업데이트
		const slides = [...(swiper?.slides || [])];
		if (!slides.length || keepCount < 1) return;

		slides.forEach((el) => el.classList.add(className));

		for (let i = 0; i < keepCount; i++) {
			const idx = (swiper.activeIndex + i) % slides.length;
			slides[idx]?.classList.remove(className);
		}
	};
	const setTabControl = () => { // tab control 설정
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
	const copyTextToClipboard = async (text) => { // 클립보드 복사
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
	const fileUpload = () => { // 파일 업로드
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
	const toggleCheck = () => { // 체크 박스 토글 (개인정보 동의)
		const toggleCheckBox = document.querySelectorAll('input[type="checkbox"][name^="toggle-agreement"]');

		toggleCheckBox.forEach((el) => {
			el.addEventListener('change', () => {
				const group = document.querySelectorAll(`input[name="${el.name}"]`);
				group.forEach((checkbox) => {
					if(checkbox !== el) {
						if(el.checked) checkbox.checked = false;
					}
				});
			});
		});
	}
	const setModalControl = () => { // 모달 설정
		const modalList = [...document.querySelectorAll('.modal')];

		if (!modalList.length) {
			return {
				openModal: () => {},
				closeModal: () => {},
				closeAllModals: () => {},
				getModal: () => null,
			};
		}

		const getModal = (target) => {
			if (!target) return null;

			if (target instanceof Element) { // element
				if (target.classList.contains('modal')) return target;
				return target.closest('.modal'); // 없으면 null
			}

			if (typeof target === 'string') { // 문자열
				return modalList.find((modal) => modal.dataset.modalMatch === target) || null;
			}

			return null;
		};

		const syncRootState = () => {
			const hasShownModal = modalList.some((modal) => modal.classList.contains('modal-shown'));
			document.documentElement.classList.toggle('modal-open', hasShownModal);
		};

		const closeModal = (target) => {
			const modal = getModal(target);
			if (!modal) return;

			modal.classList.remove('modal-shown');
			syncRootState();
		};

		const closeAllModals = () => {
			modalList.forEach((modal) => {
				modal.classList.remove('modal-shown');
			});

			syncRootState();
		};

		const openModal = (target) => {
			const modal = getModal(target);
			if (!modal) return;

			closeAllModals();
			modal.classList.add('modal-shown');
			syncRootState();
		};

		document.addEventListener('click', (event) => {
			const closeButton = event.target.closest('.btn-modal-close');
			if (closeButton) {
				closeModal(closeButton.closest('.modal'));
				return;
			}

			const dimmed = event.target.closest('.modal-dimmed');
			if (dimmed) {
				const shownModal = modalList.find((el) => el.classList.contains('modal-shown'));
				closeModal(shownModal);
				return;
			}

			const trigger = event.target.closest('[data-modal-target]');
			if (!trigger) return;

			const rawTarget = trigger.getAttribute('data-modal-target') || '';
			if (!rawTarget) return;

			openModal(rawTarget);
		});

		const autoShowModal = modalList.find((modal) => modal.classList.contains('modal-shown'));
		if (autoShowModal) {
			openModal(autoShowModal);
		}

		return {
			openModal,
			closeModal,
			closeAllModals,
			getModal,
		};
	}
	const setFilterControl = () => { // 목록 필터 설정
		const open = (target) => {
			if(!target) return;

			document.querySelector(target).classList.remove('is-folded');
		}

		const reset = (target) => {
			if(!target) return;

			const targetElement = document.querySelector(target);
			if(!targetElement) return;

			targetElement.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((el) => {
				el.checked = false;
			});
			targetElement.querySelectorAll('input[type="text"]').forEach((el) => {
				el.value = '';
			});
		}

		const close = (target) => {
			if(!target) return;

			document.querySelector(target).classList.add('is-folded');
		}

		return {
			open,
			reset,
			close
		}
	}
	const setGateMap = () => { // gate 페이지 center 표시
		const centerFlag = document.querySelectorAll('.center-flag');
		if(!centerFlag.length) return;

		centerFlag.forEach((el) => {
			const target = el.getAttribute('data-map-target');
			el.addEventListener('mouseenter', () => {
				el.classList.add('is-hovered');
				el.querySelector('.center-info').classList.remove('!hidden');

				gsap.to(el.querySelector('.center-wrap'), { 
					height: 'auto',
					duration: 0.4,
				});
				
				gsap.fromTo(el.querySelector('.center-info'), { 
					opacity: 0,
				}, { 
					opacity: 1,
					duration: 1,
				});
				
				document.querySelector(`.${target}`).style.fillOpacity = 1;
				
			});
			el.addEventListener('mouseleave', () => {
				el.classList.remove('is-hovered');
				el.querySelector('.center-info').classList.add('!hidden');

				gsap.to(el.querySelector('.center-wrap'), { 
					height: '80px',
					duration: 0.4,
				});


				document.querySelector(`.${target}`).style.fillOpacity = 0;
			});
		});
	}
	const setDropDown = () => {
		const btnDropDown = document.querySelectorAll('.drop-down button');

		btnDropDown.forEach((btn) => {
			btn.addEventListener('click', () => {
				const dropDown = btn.closest('dl');
				if (!dropDown) return;

				const isOpened = dropDown.classList.toggle('is-opened');

				if(isOpened) {
					btnDropDown.forEach((otherBtn) => {
						if(otherBtn !== btn) {
							const otherDropDown = otherBtn.closest('dl');
							if (otherDropDown) {
								otherDropDown.classList.remove('is-opened');
								otherDropDown.querySelector('dd').classList.add('!hidden');
							otherBtn.querySelector('em').textContent = '답변 열기';
							}
						}
					});
					dropDown.querySelector('dd').classList.remove('!hidden');
				btn.querySelector('em').textContent = '답변 닫기';
				}else {
					dropDown.querySelector('dd').classList.add('!hidden');
				btn.querySelector('em').textContent = '답변 열기';
				}
			});
		});
	}

	const init = () => { // 초기화
		setGateMap();
		setGnb();
		allMenu();
		setFlatPickr();
		setTabControl();
		toggleCheck();
		fileUpload();
		setDropDown();
		modalControl = setModalControl();
		filterControl = setFilterControl();

		if (pendingModalTargets.length) {
			pendingModalTargets.forEach((target) => {
				modalControl.openModal(target);
			});
			pendingModalTargets = [];
		}

	}

	return {
		init, // 초기화
		setGnb, // gnb 설정
		setSwiper, // swiper 설정
		updateDimByCount, // swiper dimmed 업데이트
		copyTextToClipboard, // 클립보드 복사
		openModal: (target) => { // 모달 on
			if (modalControl) {
				modalControl.openModal(target);
				return;
			}
			// init (초기화) 전에 모달 호출 시도한 경우 배열로 저장
			//  -> 보류 했다가 init 완료 시점에 차례로 실행
			pendingModalTargets.push(target);
		},
		closeModal: (target) => modalControl?.closeModal(target), // 모달 off
		closeAllModals: () => modalControl?.closeAllModals(), // 모달 전체 off
		getModal: (target) => modalControl?.getModal(target), // 모달 정보 가져오기
		openFilter: (target) => { // 목록 필터 on
			if(filterControl) {
				filterControl.open(target);
			}
		},
		closeFilter : (target) => { // 목록 필터 off
			if(filterControl) {
				filterControl.close(target);
			}
		},
		resetFilter : (target) => { // 목록 필터 초기화
			if(filterControl) {
				filterControl.reset(target);
			}
		}
	}
})();

window.commonFunction = commonFunction;

document.addEventListener('DOMContentLoaded', () => {
	if ($) {
		$('html').addClass('is-ready');
	}

	if (document.documentElement.classList.contains('is-ready')) {
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