SHELL := /bin/bash

all: _site

clean:
	rm -rf _site

bundle:
	bundle

serve:
	bundle exec jekyll serve

.PHONY: bundle all open serve distclean clean
