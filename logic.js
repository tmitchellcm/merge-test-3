(() => {
  class Creative {
    data;
    exit;
    adContainer;
    timeline;

    constructor({ data, exit }) {
      this.data = data;
      this.exit = exit;
      this.adContainer = document.querySelector('.ad-container');
      this.timeline = gsap.timeline({ paused: true });
    }

    startAnimation() {
      this.adContainer.classList.remove('init-hidden');
      this.timeline.play();
    }

    addStandardClickHandler() {
      this.adContainer.addEventListener('click', (e) =>
        eventClickHandler(e, this.exit.url)
      );
    }

    addAOTimelineAnimations(animations) {
      if (!animations) return;
      animations.forEach((animation) => {
        if (animation.position > 0) {
          this.timeline.set(
            `${animation.className}`,
            {
              visibility: 'hidden',
              data: { className: animation.className },
            },
            0
          );
        }
      });
      animations.forEach((animation) => {
        const { className, position, from, to } = animation;
        this.timeline.add(
          gsap.fromTo(className, { ...from }, { ...to }),
          position
        );
      });
    }

    addAOEventAnimations(animations, events) {
      const eventListenerMap = { click: 'click', hover: 'mouseenter' };
      events.forEach((event) => {
        const { className: sourceCn, eventType, start, id: eventId } = event;
        this.adContainer
          .querySelector(sourceCn)
          .addEventListener(eventListenerMap[eventType], (event) => {
            event.stopPropagation();
            if (this.timeline.time() * 1000 > start) {
              const eventAnimations = animations.filter(
                (animation) => animation.eventId === eventId
              );
              const eventTl = gsap.timeline({
                id: eventId,
                paused: true,
              });
              eventAnimations.forEach((eventAnimation) => {
                const {
                  className: targetCn,
                  position,
                  from,
                  to,
                } = eventAnimation;
                eventTl.add(
                  gsap.fromTo(
                    targetCn,
                    { ...from },
                    { ...to, immediateRender: false }
                  ),
                  position
                );
              });
              eventTl.play();
            }
          });
      });
    }
  }

  function attemptInit() {
    if (Enabler.isInitialized()) {
      if (Enabler.isPageLoaded()) {
        politeInit();
      } else {
        Enabler.addEventListener(
          studio.events.StudioEvent.PAGE_LOADED,
          politeInit
        );
      }
    } else {
      Enabler.addEventListener(studio.events.StudioEvent.INIT, attemptInit);
    }
  }

  function politeInit() {
    const creative = new Creative({
      data: { url: dynamicContent.creative_feed[0].data_url },
      exit: { url: dynamicContent.creative_feed[0].exit_url },
    });
    buildAd(creative);
  }

  async function buildAd(creative) {
    const templateString = await getTemplate(creative.data.url);
    const parsedTemplate = parseHTMLTemplate(templateString);
    injectContent(creative, parsedTemplate);
    if (Enabler.isVisible()) {
      dispatchTemplateInitEvent(creative);
    } else {
      Enabler.addEventListener(studio.events.StudioEvent.VISIBLE, () =>
        dispatchTemplateInitEvent(creative)
      );
    }
  }

  async function getTemplate(url) {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(url);
        if (url.endsWith('.json')) {
          const data = await response.json();
          resolve(data.html);
        } else if (url.endsWith('.html')) {
          resolve(response.text());
        } else {
          throw new Error('Data URL extension not recognised.');
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function parseHTMLTemplate(templateString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateString, 'text/html');
    const headContent = doc.head.innerHTML;
    const bodyContent = doc.body.innerHTML;
    const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    const bodyScripts = bodyContent.match(scriptRegex) || [];
    const htmlElements = bodyContent.replace(scriptRegex, '').trim();
    return {
      headContent,
      htmlElements,
      bodyScripts,
    };
  }

  function injectContent(creative, parsedContent) {
    const { headContent, htmlElements, bodyScripts } = parsedContent;
    const { adContainer } = creative;
    document.head.insertAdjacentHTML('beforeend', headContent);
    if (adContainer) {
      adContainer.innerHTML = htmlElements;
    } else {
      console.error('Target container .ad-container not found in the document');
    }
    bodyScripts.forEach((script) => {
      const scriptEl = document.createElement('script');
      scriptEl.textContent = script.replace(/<\/?script[^>]*>/gi, '').trim();
      document.body.appendChild(scriptEl);
    });
  }

  function dispatchTemplateInitEvent(creative) {
    document.dispatchEvent(
      new CustomEvent('templateInit', {
        detail: { creative },
      })
    );
  }

  function eventClickHandler(event, url) {
    event.preventDefault();
    Enabler.exitOverride('DynamicExit', url);
  }

  window.addEventListener('load', attemptInit);
})();
