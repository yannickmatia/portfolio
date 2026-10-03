(function () {
  "use strict";

  function track(eventName, link, destination) {
    if (typeof window.gtag !== "function") return;

    window.gtag("event", eventName, {
      link_url: destination,
      link_text: (link.textContent || link.getAttribute("aria-label") || "").trim(),
      page_location: window.location.href
    });
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    if (!link) return;

    var href = link.getAttribute("href");
    if (!href) return;

    if (href.indexOf("mailto:") === 0) {
      track("contact_click", link, href);
      return;
    }

    var destination;
    try {
      destination = new URL(href, window.location.href);
    } catch (error) {
      return;
    }

    if (/\.pdf$/i.test(destination.pathname)) {
      track(link.hasAttribute("download") ? "resume_download" : "resume_open", link, destination.href);
      return;
    }

    if (destination.hostname.indexOf("substack.com") !== -1) {
      track("substack_click", link, destination.href);
    } else if (destination.hostname.indexOf("medium.com") !== -1) {
      track("medium_click", link, destination.href);
    } else if (destination.hostname.indexOf("linkedin.com") !== -1) {
      track("linkedin_click", link, destination.href);
    } else if (destination.hostname.indexOf("instagram.com") !== -1) {
      track("instagram_click", link, destination.href);
    }
  });
})();
