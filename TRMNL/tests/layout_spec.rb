require 'json'
require 'fileutils'

RSpec.describe 'ARC Raiders layouts' do
  fixture = JSON.parse(File.read(File.join(__dir__, 'fixtures/schedule.json')))
  now = '2026-11-17T18:15:00Z'
  epoch = Time.iso8601(now).to_i * 1000
  crowded = Marshal.load(Marshal.dump(fixture))
  crowded['data'] += fixture['data'].drop(4).map { it.merge('startTime' => epoch - 600000, 'endTime' => epoch + 3600000) }
  long_names = Marshal.load(Marshal.dump(fixture))
  long_names['data'][0].merge!('name' => 'Electromagnetic Storm', 'map' => 'Dam Battlegrounds', 'endTime' => epoch + 60000)
  long_names['data'][1]['name'] = 'An unfamiliar condition with a very long name & <script>alert(1)</script>'
  long_names['region'] = 'north-america'
  overnight = Marshal.load(Marshal.dump(fixture))
  overnight['data'].each { it['startTime'] += 4 * 3600000; it['endTime'] += 4 * 3600000 }
  overnight['cachedAt'] += 4 * 3600000
  fallback = {
    'region' => 'europe',
    'data' => [
      { 'name' => 'Night Raid', 'map' => 'Dam',
        'startTime' => Time.iso8601('2026-10-25T00:00:00Z').to_i * 1000,
        'endTime' => Time.iso8601('2026-10-25T01:00:00Z').to_i * 1000 },
      { 'name' => 'Cold Snap', 'map' => 'Spaceport',
        'startTime' => Time.iso8601('2026-10-25T00:30:00Z').to_i * 1000,
        'endTime' => Time.iso8601('2026-10-25T01:30:00Z').to_i * 1000 }
    ]
  }
  late_condition = {
    'region' => 'north-america',
    'data' => [{ 'name' => 'Electromagnetic Storm', 'map' => 'Dam Battlegrounds',
                 'startTime' => epoch + 86340000, 'endTime' => epoch + 89940000 }]
  }
  cases = {
    'ordinary' => [fixture, now],
    'crowded' => [crowded, now],
    'long-names' => [long_names, now],
    'empty' => [fixture.merge('data' => []), now],
    'unavailable' => [fixture.merge('data' => { 'error' => 'backend down' }), now],
    'stale' => [fixture.merge('cachedAt' => epoch - 4 * 3600000), now],
    'overnight' => [overnight, '2026-11-17T22:15:00Z'],
    'dst-fallback' => [fallback, '2026-10-25T00:15:00Z'],
    'long-countdown' => [late_condition, now],
    'future-only' => [fixture.merge('data' => fixture['data'].drop(4)), now],
    'active-only' => [fixture.merge('data' => fixture['data'].take(4)), now]
  }
  views = %w[full half_horizontal half_vertical quadrant]
  devices = {
    'og' => { model: 'og_png', width: 800, height: 480, bit_depth: 1, screen_classes: 'screen screen--og_png screen--md screen--1bit' },
    'x' => { model: 'v2', width: 1872, height: 1404, bit_depth: 4, screen_classes: 'screen screen--v2 screen--lg screen--4bit' },
    'og-2bit' => { model: 'og_plus', width: 800, height: 480, bit_depth: 2, screen_classes: 'screen screen--ogv2 screen--md screen--2bit' }
  }
  capacities = { 'og' => [3, 2, 4, 1], 'x' => [4, 3, 5, 2], 'og-2bit' => [3, 2, 4, 1] }

  cases.each do |scenario, (data, time)|
    devices.each do |name, device|
      next if name == 'og-2bit' && scenario != 'ordinary'

      views.each_with_index do |view, index|
        it "renders #{scenario} #{name} #{view}" do
          screen = trmnl.render(view: view, device: device, now: time, data: data)
          FileUtils.mkdir_p('_build/previews')
          image = MiniMagick::Image.read(screen.png_bytes)
          box = screen.box('.view')
          image.crop("#{box.width.round}x#{box.height.round}+#{box.left.round}+#{box.top.round}")
          image.write("_build/previews/#{scenario}-#{name}-#{view}.png")
          expect(screen).to have_no_transform_error
          expect(screen).to have_no_leaked_text
          expect(screen).to have_no_problems
          expect(screen).to have_no_overflow
          expect(screen).to have_no_text_clamped_with_room_to_spare
          expect(screen).to have_no_overlapping_text
          small_text = screen.evaluate(<<~JS)
            (() => {
              const tooSmall = [], minimum = #{name == 'x' ? 21 : 16};
              const walker = document.createTreeWalker(document.querySelector('.view'), NodeFilter.SHOW_TEXT);
              for (let node; node = walker.nextNode();) {
                const text = node.textContent.trim(), el = node.parentElement;
                if (!text || el.closest('svg') || !el.getClientRects().length) continue;
                const pixels = parseFloat(getComputedStyle(el).fontSize);
                if (pixels < minimum - 0.1) tooSmall.push({ text, pixels });
              }
              return tooSmall;
            })()
          JS
          expect(small_text).to be_empty
          expect(screen).to have_no_css('footer')
          expect(screen.text.upcase.gsub(/\s+/, '')).to include('ENDS02:00CET') if scenario == 'dst-fallback'
          expect(screen).to have_text('STALE SOURCE') if scenario == 'stale'

          b = screen.result.data.fetch('briefing')
          rows = screen.all('[data-entry]')
          limit = capacities.fetch(name)[index] - (b['stale'] ? 1 : 0)
          feature = b['live'].first || b['next'].first
          expected = if view == 'full'
                       others = b['live'].drop(1).take(limit)
                       next_offset = feature && !feature['active'] ? 1 : 0
                       [feature, *others, *b['next'].drop(next_offset).take(name == 'x' ? 4 : 3)].compact
                     else
                       (b['live'] + b['next']).take(limit + 1)
                     end
          expect(rows.size).to eq(expected.size)
          expect(rows.map { it['data-active'] }).to eq(expected.map { it['active'].to_s })
          rows.zip(expected).each do |row, entry|
            next if entry['name'].start_with?('An unfamiliar')

            expect(row.find('[data-condition-name]').text.downcase).to eq(entry['name'].downcase)
          end
          omitted = screen.all('[data-omitted]').sum { it['data-omitted'].to_i }
          expect(omitted + rows.size).to eq(b['live'].size + b['next'].size)
          expect(screen.text.downcase).to include(b['status'].downcase) unless b['status'] == 'Schedule ready'
          expect(screen.evaluate("document.querySelectorAll('.view script').length")).to eq(0)
          expect(screen.evaluate("[...document.querySelectorAll('.view img')].every(img => img.complete && img.naturalWidth > 0)")).to be(true)
        end
      end
    end
  end
end
