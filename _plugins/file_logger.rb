Jekyll::Hooks.register :site, :post_render do |site|
    site.pages.each do |page|
      puts "Processing file: #{page.relative_path}"
    end
  end
  